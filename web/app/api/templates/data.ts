export type TemplateActivity = {
  type: 'brainstorm'|'stocktake'|'assignment';
  title: string;
  instructions?: string;
  description?: string;
  config?: any;
  initiatives?: string[]; // for stocktake
};

export type Template = {
  id: string;
  name: string;
  blurb: string;
  activities: TemplateActivity[];
};

export const templates: Template[] = [
  {
    id: 'strategy_session_v1',
    name: 'Strategy Session',
    blurb: 'Align on a future vision, assess current practices, and define concrete knowledge-sharing steps.',
    activities: [
      {
        type: 'brainstorm',
        title: 'Future Team Vision',
        instructions: 'Imagine it is 18 months from now and your team is thriving. Jot down short bullets of what is true in that future (customer impact, ways of working, metrics, capabilities). Stay concise: one idea per line.',
        description: 'Outcome: a crisp, inspiring description of success to guide strategy choices.',
        config: { voting_enabled: true, max_submissions: 5, time_limit_sec: 480, points_budget: 100 },
      },
      {
        type: 'stocktake',
        title: 'Process Stocktake',
        instructions: 'For each initiative, reflect on whether we should Stop, Do Less, Keep the Same, Do More, or Begin. Answer individually, then discuss as a group.',
        description: 'Outcome: a prioritized view of team practices to evolve.',
        config: { time_limit_sec: 420 },
        initiatives: [
          'Hold monthly team meetings',
          'Facilitate quarterly knowledge sharing sessions for the whole department',
          'Run lightweight weekly standups (15 minutes)',
          'Publish a monthly “What we learned” digest',
          'Adopt a rotating “demo day” for team work-in-progress',
        ],
      },
      {
        type: 'brainstorm',
        title: 'Outline a Knowledge-Sharing Session',
        instructions: 'Draft a simple outline: objective, audience, 3–4 segments (5–10 min each), and one interactive element. Keep it short and practical.',
        description: 'Outcome: reusable blueprint for an internal knowledge session.',
        config: { voting_enabled: false, max_submissions: 3, time_limit_sec: 420 },
      },
      {
        type: 'brainstorm',
        title: 'Describe Your Team to Different Audiences',
        instructions: 'Write one-sentence descriptions of what your team does for: (1) executives, (2) peers, (3) customers, (4) candidates. One sentence per audience.',
        description: 'Outcome: audience-tailored narratives to improve communication and alignment.',
        config: { voting_enabled: false, max_submissions: 4, time_limit_sec: 360 },
      },
    ],
  },
  {
    id: 'retrospective_v1',
    name: 'Team Retrospective',
    blurb: 'Reflect on what to Stop/Start/Continue and surface top improvements.',
    activities: [
      { type: 'brainstorm', title: 'What Went Well', instructions: 'Add short bullets for wins and bright spots.', description: 'Celebrate wins to reinforce behaviors.', config: { voting_enabled: true, max_submissions: 5, time_limit_sec: 420, points_budget: 50 } },
      { type: 'brainstorm', title: 'What To Improve', instructions: 'Add concise issues or friction points. One per line.', description: 'Identify improvement areas.', config: { voting_enabled: true, max_submissions: 5, time_limit_sec: 420, points_budget: 50 } },
      { type: 'stocktake', title: 'Stop / Less / Same / More / Begin', instructions: 'For each practice, choose what we should do next cycle.', description: 'Turn insights into clear direction.', config: { time_limit_sec: 360 }, initiatives: ['Long status meetings', 'Ad-hoc work intake', 'Pairing sessions', 'Release demos', 'Customer interviews'] },
    ],
  },
  {
    id: 'initiative_kickoff_v1',
    name: 'Initiative Kickoff',
    blurb: 'Frame the problem, map stakeholders, and plan next steps.',
    activities: [
      { type: 'brainstorm', title: 'Problem Framing', instructions: 'Describe the problem and why it matters: who is affected, impact, constraints.', description: 'Shared understanding of the problem.', config: { voting_enabled: false, max_submissions: 3, time_limit_sec: 360 } },
      { type: 'brainstorm', title: 'Stakeholders + Risks', instructions: 'List key stakeholders and top 3 risks or unknowns.', description: 'Surface dependencies and risks.', config: { voting_enabled: false, max_submissions: 3, time_limit_sec: 360 } },
      { type: 'brainstorm', title: 'First Two Weeks Plan', instructions: 'Outline concrete actions for the first two weeks.', description: 'Bias to action with immediate next steps.', config: { voting_enabled: false, max_submissions: 3, time_limit_sec: 300 } },
    ],
  },
  {
    id: 'problem_solving_jam_v1',
    name: 'Problem-Solving Jam',
    blurb: 'Surface top problems, swarm solutions, and align on next moves.',
    activities: [
      {
        type: 'brainstorm',
        title: 'What’s blocking us right now?',
        instructions: 'Add concrete problems or friction points. Keep items short — one idea per line.',
        description: 'Create a shared list of pain points to address.',
        config: { voting_enabled: true, max_submissions: 5, time_limit_sec: 420, points_budget: 60 },
      },
      {
        type: 'brainstorm',
        title: 'Solution ideas',
        instructions: 'Propose scrappy, practical solutions. Prefer specific, testable actions.',
        description: 'Generate options before deciding what to try.',
        config: { voting_enabled: true, max_submissions: 5, time_limit_sec: 420, points_budget: 60 },
      },
      {
        type: 'stocktake',
        title: 'Prioritize practices',
        instructions: 'For each practice, decide what to do next cycle (Stop/Less/Same/More/Begin).',
        description: 'Align on which practices to evolve immediately.',
        config: { time_limit_sec: 360 },
        initiatives: ['Unplanned work intake', 'Ad-hoc releases', 'Pairing blocks', 'Weekly demos', 'Post-incident reviews'],
      },
    ],
  },
  {
    id: 'brainwriting_rounds_v1',
    name: 'Brainwriting Rounds',
    blurb: 'Assign prompts to groups for fast parallel idea generation, then converge.',
    activities: [
      {
        type: 'assignment',
        title: 'Brainwriting prompts',
        instructions: 'Each group gets one prompt. Add short, independent ideas. Rotate prompts across groups if desired.',
        description: 'Parallelize ideation by assigning prompts to groups.',
        config: {
          voting_enabled: true,
          max_submissions: 5,
          time_limit_sec: 480,
          points_budget: 80,
          prompts: [
            'Reduce handoffs in workflow',
            'Improve onboarding in first 30 days',
            'Lower cycle time for small changes',
            'Share knowledge across teams',
            'Make work more visible',
          ],
        },
      },
      {
        type: 'brainstorm',
        title: 'Top ideas to try',
        instructions: 'Nominate the strongest ideas your group would pilot next month.',
        description: 'Converge on a short list of experiments.',
        config: { voting_enabled: true, max_submissions: 3, time_limit_sec: 300, points_budget: 40 },
      },
    ],
  },
  {
    id: 'onboarding_workshop_v1',
    name: 'Onboarding Workshop',
    blurb: 'Craft crisp messaging and identify early risks for new joiners.',
    activities: [
      {
        type: 'assignment',
        title: 'Audience pitches',
        instructions: 'Each group drafts one pitch. Keep it clear and concrete.',
        description: 'Create short messages tailored to different audiences.',
        config: {
          voting_enabled: false,
          max_submissions: 3,
          time_limit_sec: 420,
          points_budget: 30,
          prompts: [
            'One-line value prop for executives',
            'Two-minute intro for new teammates',
            'Customer-facing elevator pitch (30 seconds)',
            'Recruiting blurb for candidates',
          ],
        },
      },
      {
        type: 'brainstorm',
        title: 'First-30-days risks',
        instructions: 'List the biggest risks or pitfalls for new joiners. One per line.',
        description: 'Proactively surface and mitigate onboarding risks.',
        config: { voting_enabled: true, max_submissions: 5, time_limit_sec: 300, points_budget: 50 },
      },
    ],
  },
];
