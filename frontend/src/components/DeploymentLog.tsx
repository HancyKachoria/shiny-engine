import { useEffect, useRef } from 'react';
import type { DeploymentStep } from '../services/api';

interface DeploymentLogProps {
  steps: DeploymentStep[];
}

const DeploymentLog: React.FC<DeploymentLogProps> = ({ steps }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  const getStatusIcon = (step: DeploymentStep) => {
    if (step.completed) {
      return '✓';
    }
    // Check if this is the current step (last one in array)
    const isCurrent = steps.indexOf(step) === steps.length - 1;
    if (isCurrent && steps.length > 0) {
      return '⟳';
    }
    return '○';
  };

  const getStatusColor = (step: DeploymentStep) => {
    if (step.completed) {
      return 'text-green-400';
    }
    // Check if this is the current step
    const isCurrent = steps.indexOf(step) === steps.length - 1;
    if (isCurrent && steps.length > 0) {
      return 'text-blue-400';
    }
    return 'text-gray-500';
  };

  const getPlatformIcon = (platform: DeploymentStep['platform']) => {
    switch (platform) {
      case 'neon':
        return '💚';
      case 'railway':
        return '🚂';
      case 'vercel':
        return '▲';
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Deployment Progress</h2>
      <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-h-96 overflow-y-auto">
        <div className="space-y-3 font-mono text-sm">
          {steps.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Waiting for deployment to start...
            </div>
          ) : (
            steps.map((step, index) => (
              <div
                key={`${step.step}-${index}`}
                className="flex items-start gap-3 p-2 rounded hover:bg-dark-hover transition-colors"
              >
                <span className={`text-lg ${getStatusColor(step)}`}>
                  {getStatusIcon(step)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getPlatformIcon(step.platform)}</span>
                    <span className="text-gray-300 capitalize">{step.platform}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400 text-xs">
                      Step {step.step}/{step.total}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400 text-xs">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-200">{step.message}</p>
                </div>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};

export default DeploymentLog;
