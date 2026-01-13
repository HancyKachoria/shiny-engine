import type { DeploymentPlan as PlanType } from '../services/api';

interface DeploymentPlanProps {
  plan: PlanType;
}

const DeploymentPlan: React.FC<DeploymentPlanProps> = ({ plan }) => {
  const platforms = [
    {
      name: 'Neon',
      icon: '💚',
      data: plan.neon,
      description: 'PostgreSQL Database',
    },
    {
      name: 'Railway',
      icon: '🚂',
      data: plan.railway,
      description: 'Backend API',
    },
    {
      name: 'Vercel',
      icon: '▲',
      data: plan.vercel,
      description: 'Frontend Application',
    },
  ];

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Deployment Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <div
            key={platform.name}
            className="bg-dark-surface border border-dark-border rounded-lg p-6 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{platform.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-100">{platform.name}</h3>
                <p className="text-sm text-gray-400">{platform.description}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-300 mb-2">Project Name:</p>
              <p className="text-gray-100 font-mono text-sm bg-dark-bg px-2 py-1 rounded">
                {platform.data.name}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  platform.data.status === 'ready'
                    ? 'bg-green-500'
                    : 'bg-gray-500'
                }`}
              />
              <span className="text-xs text-gray-400 capitalize">
                {platform.data.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeploymentPlan;
