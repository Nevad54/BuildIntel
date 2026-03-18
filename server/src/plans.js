export const planRules = {
  Starter: {
    maxProjects: 5,
    aiEstimates: false,
    supplierComparison: false
  },
  Pro: {
    maxProjects: null,
    aiEstimates: true,
    supplierComparison: true
  },
  Enterprise: {
    maxProjects: null,
    aiEstimates: true,
    supplierComparison: true
  }
};

export const getPlanRule = (planName) => planRules[planName] || planRules.Starter;

export const buildPlanUsage = ({ plan, projectsCount }) => {
  const rule = getPlanRule(plan);

  return {
    plan,
    limits: {
      maxProjects: rule.maxProjects
    },
    usage: {
      projects: projectsCount
    },
    features: {
      aiEstimates: rule.aiEstimates,
      supplierComparison: rule.supplierComparison
    }
  };
};
