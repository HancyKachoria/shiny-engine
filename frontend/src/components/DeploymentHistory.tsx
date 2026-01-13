import { useState, useEffect } from 'react';

interface DeploymentHistoryItem {
  id: string;
  githubUrl: string;
  timestamp: number;
  deployments?: {
    neon?: { databaseUrl?: string };
    railway?: { url?: string };
    vercel?: { projectUrl?: string };
  };
}

interface DeploymentHistoryProps {
  onSelectUrl: (url: string) => void;
}

const DeploymentHistory = ({ onSelectUrl }: DeploymentHistoryProps) => {
  const [history, setHistory] = useState<DeploymentHistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('deploymentHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setHistory([]);
      }
    }
  }, []);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('deploymentHistory');
  };

  // Expose saveToHistory via window for App.tsx to use
  useEffect(() => {
    const saveToHistory = (item: Omit<DeploymentHistoryItem, 'id' | 'timestamp'>) => {
      const newItem: DeploymentHistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        ...item,
      };

      setHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, 5); // Keep only last 5
        localStorage.setItem('deploymentHistory', JSON.stringify(updated));
        return updated;
      });
    };

    (window as any).saveDeploymentToHistory = saveToHistory;
    return () => {
      delete (window as any).saveDeploymentToHistory;
    };
  }, []);

  if (history.length === 0 && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 top-4 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-gray-300 hover:bg-dark-hover transition-colors text-sm"
      >
        📋 History
      </button>
    );
  }

  return (
    <div
      className={`fixed right-0 top-0 h-full w-80 bg-dark-surface border-l border-dark-border transform transition-transform duration-300 z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Deployment History</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Clear History
          </button>
        )}
      </div>

      <div className="overflow-y-auto h-[calc(100vh-100px)] p-4">
        {history.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No deployment history yet</p>
            <p className="text-xs mt-2">Your recent deployments will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-dark-bg border border-dark-border rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-300 truncate" title={item.githubUrl}>
                    {item.githubUrl.split('/').pop()}
                  </p>
                </div>

                {item.deployments && (
                  <div className="space-y-2 mt-3">
                    {item.deployments.vercel?.projectUrl && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Frontend (Vercel)</p>
                        <button
                          onClick={() => {
                            onSelectUrl(item.deployments!.vercel!.projectUrl!);
                            window.open(item.deployments!.vercel!.projectUrl, '_blank');
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 truncate block w-full text-left"
                        >
                          {item.deployments.vercel.projectUrl}
                        </button>
                      </div>
                    )}
                    {item.deployments.railway?.url && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Backend (Railway)</p>
                        <button
                          onClick={() => {
                            onSelectUrl(item.deployments!.railway!.url!);
                            window.open(item.deployments!.railway!.url, '_blank');
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 truncate block w-full text-left"
                        >
                          {item.deployments.railway.url}
                        </button>
                      </div>
                    )}
                    {item.deployments.neon?.databaseUrl && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Database (Neon)</p>
                        <button
                          onClick={() => {
                            onSelectUrl(item.deployments!.neon!.databaseUrl!);
                            window.open('https://console.neon.tech', '_blank');
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 truncate block w-full text-left"
                        >
                          {item.deployments.neon.databaseUrl.substring(0, 40)}...
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeploymentHistory;
