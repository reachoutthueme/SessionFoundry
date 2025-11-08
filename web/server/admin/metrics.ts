import "server-only";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

type Kpis = {
  sessions_last_7d: number;
  sessions_last_28d: number;
  completion_rate_28d: number;
  avg_participants_per_session_28d: number;
  avg_submissions_per_session_28d: number;
};

type Health = {
  db_ok: boolean;
  env: {
    supabase_url: boolean;
    supabase_key: boolean;
  };
};

export type AdminOverviewMetrics = { kpis: Partial<Kpis>; health: Health };

function defaults(db_ok: boolean): AdminOverviewMetrics {
  return {
    kpis: {
      sessions_last_7d: 0,
      sessions_last_28d: 0,
      completion_rate_28d: 0,
      avg_participants_per_session_28d: 0,
      avg_submissions_per_session_28d: 0,
    },
    health: {
      db_ok,
      env: {
        supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    },
  };
}

export async function getAdminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  if (!isSupabaseAdminConfigured()) {
    return defaults(false);
  }

  try {
    const now = Date.now();
    const iso7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const iso28d = new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString();

    // Pull sessions in the last 28 days (id + created_at)
    const sessionsRes = await supabaseAdmin
      .from("sessions")
      .select("id, created_at, status")
      .gte("created_at", iso28d)
      .limit(10000);
    if (sessionsRes.error) throw sessionsRes.error;
    const sessions = sessionsRes.data || [];

    const sessions_last_28d = sessions.length;
    const sessions_last_7d = sessions.filter((s) => new Date(s.created_at).toISOString() >= iso7d).length;

    // Early return if no sessions to aggregate
    if (sessions.length === 0) {
      return {
        kpis: {
          sessions_last_7d,
          sessions_last_28d,
          completion_rate_28d: 0,
          avg_participants_per_session_28d: 0,
          avg_submissions_per_session_28d: 0,
        },
        health: {
          db_ok: true,
          env: {
            supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          },
        },
      };
    }

    const sessionIds = sessions.map((s: any) => s.id);

    // Activities for those sessions (id, session_id, status)
    const activitiesRes = await supabaseAdmin
      .from("activities")
      .select("id, session_id, status")
      .in("session_id", sessionIds)
      .limit(50000);
    if (activitiesRes.error) throw activitiesRes.error;
    const activities = activitiesRes.data || [];

    const activityIds = activities.map((a: any) => a.id);
    const activityToSession = new Map<string, string>();
    for (const a of activities) activityToSession.set(a.id, a.session_id);

    // Completion rate: completed if session.status = 'Closed' OR (has >=1 activity and all activities are 'Closed')
    const bySessionStatuses = new Map<string, string[]>();
    for (const a of activities) {
      const arr = bySessionStatuses.get(a.session_id) || [];
      arr.push(a.status);
      bySessionStatuses.set(a.session_id, arr);
    }
    let completedSessions = 0;
    const sessionStatusById = new Map<string, string | undefined>();
    for (const s of sessions) sessionStatusById.set(s.id, (s as any).status);
    for (const sid of sessionIds) {
      const sessStatus = (sessionStatusById.get(sid) || "").toLowerCase();
      if (sessStatus === "closed") {
        completedSessions += 1;
        continue;
      }
      const statuses = (bySessionStatuses.get(sid) || []).map((x) => String(x));
      if (statuses.length > 0 && statuses.every((st) => st === "Closed")) completedSessions += 1;
    }
    const completion_rate_28d = sessions_last_28d > 0 ? completedSessions / sessions_last_28d : 0;

    // Average submissions per session (brainstorm submissions only)
    let avg_submissions_per_session_28d = 0;
    if (activityIds.length > 0) {
      const submissionsRes = await supabaseAdmin
        .from("submissions")
        .select("activity_id, participant_id")
        .in("activity_id", activityIds)
        .limit(200000);
      if (submissionsRes.error) throw submissionsRes.error;
      const submissions = submissionsRes.data || [];

      const submissionsBySession = new Map<string, number>();
      for (const row of submissions) {
        const sid = activityToSession.get(row.activity_id);
        if (!sid) continue;
        submissionsBySession.set(sid, (submissionsBySession.get(sid) || 0) + 1);
      }
      let totalSubs = 0;
      for (const sid of sessionIds) totalSubs += submissionsBySession.get(sid) || 0;
      avg_submissions_per_session_28d = sessions_last_28d > 0 ? totalSubs / sessions_last_28d : 0;

      // Average participants per session (distinct participants across submissions + stocktake + votes)
      // Start with participants from submissions
      const participantsBySession = new Map<string, Set<string>>();
      for (const row of submissions) {
        const sid = activityToSession.get(row.activity_id);
        if (!sid) continue;
        if (!participantsBySession.has(sid)) participantsBySession.set(sid, new Set());
        if (row.participant_id) participantsBySession.get(sid)!.add(row.participant_id);
      }

      // Add participants from stocktake_responses
      const stocktakeRes = await supabaseAdmin
        .from("stocktake_responses")
        .select("activity_id, participant_id")
        .in("activity_id", activityIds)
        .limit(200000);
      if (stocktakeRes.error) throw stocktakeRes.error;
      const stocktake = stocktakeRes.data || [];
      for (const row of stocktake) {
        const sid = activityToSession.get(row.activity_id);
        if (!sid) continue;
        if (!participantsBySession.has(sid)) participantsBySession.set(sid, new Set());
        if (row.participant_id) participantsBySession.get(sid)!.add(row.participant_id);
      }

      // Add participants from votes (voter_id)
      const votesRes = await supabaseAdmin
        .from("votes")
        .select("activity_id, voter_id")
        .in("activity_id", activityIds)
        .limit(200000);
      if (votesRes.error) throw votesRes.error;
      const votes = votesRes.data || [];
      for (const row of votes) {
        const sid = activityToSession.get(row.activity_id);
        if (!sid) continue;
        if (!participantsBySession.has(sid)) participantsBySession.set(sid, new Set());
        if (row.voter_id) participantsBySession.get(sid)!.add(row.voter_id);
      }

      let totalParticipants = 0;
      for (const sid of sessionIds) totalParticipants += (participantsBySession.get(sid)?.size || 0);
      var avg_participants_per_session_28d = sessions_last_28d > 0 ? totalParticipants / sessions_last_28d : 0;

      return {
        kpis: {
          sessions_last_7d,
          sessions_last_28d,
          completion_rate_28d,
          avg_participants_per_session_28d,
          avg_submissions_per_session_28d,
        },
        health: {
          db_ok: true,
          env: {
            supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          },
        },
      };
    }

    // If there were no activities, return with zeros for activity-based metrics
    return {
      kpis: {
        sessions_last_7d,
        sessions_last_28d,
        completion_rate_28d,
        avg_participants_per_session_28d: 0,
        avg_submissions_per_session_28d: 0,
      },
      health: {
        db_ok: true,
        env: {
          supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      },
    };
  } catch (_e) {
    return defaults(false);
  }
}
