import { useState } from 'react';
import confetti from 'canvas-confetti';
import { api } from './services/api';
import type { DiscoveryResult, DeploymentPlan, DeploymentStep, DeploymentComplete } from './services/api';
import DeploymentPlanComponent from './components/DeploymentPlan';
import DeploymentLog from './components/DeploymentLog';
import DeploymentHistory from './components/DeploymentHistory';
import Logo from './components/Logo';

function App() {
  const [githubUrl, setGithubUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [deploymentPlan, setDeploymentPlan] = useState<DeploymentPlan | null>(null);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([]);
  const [deploymentUrls, setDeploymentUrls] = useState<{
    neon?: string;
    railway?: string;
    vercel?: string;
  } | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!githubUrl.trim()) {
      alert('Please enter a GitHub URL');
      return;
    }

    setIsAnalyzing(true);
    setDiscovery(null);
    setDeploymentPlan(null);

    try {
      const result = await api.analyzeRepository(githubUrl);
      setDiscovery(result);

      const plan = await api.getDeploymentPlan(githubUrl, result);
      setDeploymentPlan(plan);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      alert(`Analysis failed: ${error.message || 'Please try again.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeploy = async () => {
    if (!deploymentPlan) {
      alert('Please analyze the repository first');
      return;
    }

    setIsDeploying(true);
    setDeploymentSteps([]);
    setDeploymentUrls(null);
    setDeploymentError(null);

    let finalSteps: DeploymentStep[] = [];

    try {
      await api.deployFullTrinity(
        githubUrl,
        deploymentPlan.railway.name,
        deploymentPlan.railway.name, // service name
        false, // dryRun
        (step: DeploymentStep) => {
          finalSteps = [...finalSteps, step];
          setDeploymentSteps(finalSteps);
        },
        (result: DeploymentComplete) => {
          if (result.deployments) {
            const urls = {
              neon: result.deployments.neon?.databaseUrl,
              railway: result.deployments.railway?.url,
              vercel: result.deployments.vercel?.projectUrl,
            };
            setDeploymentUrls(urls);

            // Trigger confetti celebration when deployment completes
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
            });

            // Save to history
            if ((window as any).saveDeploymentToHistory) {
              (window as any).saveDeploymentToHistory({
                githubUrl,
                deployments: result.deployments,
              });
            }
          }
          setIsDeploying(false);
        },
        (error: Error) => {
          console.error('Deployment failed:', error);
          setDeploymentError(error.message);
          setIsDeploying(false);
        }
      );
    } catch (error: any) {
      console.error('Deployment failed:', error);
      alert(`Deployment failed: ${error.message || 'Please try again.'}`);
      setIsDeploying(false);
    }
  };

  const handleSelectUrl = (_url: string) => {
    // URL is already being opened by the history component
    // This can be used for additional actions if needed
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <DeploymentHistory onSelectUrl={handleSelectUrl} />
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-12 flex items-center gap-4">
          <Logo size="lg" className="flex-shrink-0" />
          <div>
            <h1 className="text-4xl font-bold text-gray-100 mb-2">
              Cursor 2.0
            </h1>
            <p className="text-gray-400 text-lg">
              Unified Deployment Orchestrator
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-dark-surface border border-dark-border rounded-lg p-8">
          {/* GitHub URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Repository URL
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="flex-1 px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isAnalyzing || isDeploying}
              />
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || isDeploying || !githubUrl.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* Discovery Results */}
          {discovery && (
            <div className="mb-6 p-4 bg-dark-bg border border-dark-border rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Discovery Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-gray-100 font-semibold capitalize">{discovery.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Confidence</p>
                  <p className="text-gray-100 font-semibold">
                    {(discovery.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Indicators</p>
                  <p className="text-gray-100 font-semibold">{discovery.indicators.length}</p>
                </div>
                {discovery.metadata?.framework && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Framework</p>
                    <p className="text-gray-100 font-semibold">{discovery.metadata.framework}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deployment Plan */}
          {deploymentPlan && (
            <>
              <DeploymentPlanComponent plan={deploymentPlan} />

              {/* Deploy Button */}
              <div className="mt-8">
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {isDeploying ? 'Deploying...' : 'Deploy Full Trinity'}
                </button>
              </div>
            </>
          )}

          {/* Deployment Log */}
          {isDeploying && <DeploymentLog steps={deploymentSteps} />}

          {/* Deployment Error */}
          {deploymentError && !isDeploying && (
            <div className="mt-8 p-6 bg-red-900/20 border border-red-700/50 rounded-lg">
              <h3 className="text-lg font-semibold text-red-400 mb-4">
                ✗ Deployment Failed
              </h3>
              <p className="text-gray-200 mb-2">{deploymentError}</p>
              <p className="text-sm text-gray-400">
                All created resources have been automatically cleaned up to prevent charges.
              </p>
            </div>
          )}

          {/* Deployment Success */}
          {deploymentUrls && !isDeploying && !deploymentError && (
            <div className="mt-8 p-6 bg-green-900/20 border border-green-700/50 rounded-lg">
              <h3 className="text-lg font-semibold text-green-400 mb-4">
                ✓ Deployment Complete!
              </h3>
              <div className="space-y-3">
                {deploymentUrls.vercel && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Frontend (Vercel)</p>
                    <a
                      href={deploymentUrls.vercel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {deploymentUrls.vercel}
                    </a>
                  </div>
                )}
                {deploymentUrls.railway && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Backend (Railway)</p>
                    <a
                      href={deploymentUrls.railway}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {deploymentUrls.railway}
                    </a>
                  </div>
                )}
                {deploymentUrls.neon && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Database (Neon)</p>
                    <a
                      href={deploymentUrls.neon}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      {deploymentUrls.neon}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
