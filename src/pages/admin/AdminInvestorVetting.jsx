import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

const AdminInvestorVetting = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await adminApi.investorRequests({ limit: 50 });
            setRequests(res.data || res || []);
        } catch (err) {
            setError(err.message || 'Failed to fetch requests');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id, status) => {
        setProcessingId(id);
        setError('');
        try {
            await adminApi.updateInvestorRequest(id, status);
            // Local update to avoid full refetch
            setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
        } catch (err) {
            setError(err.message || `Failed to ${status.toLowerCase()} request`);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 size={32} className="animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="admin-view">
            <h1 className="text-2xl font-bold mb-6">Investor Vetting</h1>
            <p className="text-gray-600 mb-8">Review and approve applications for the verified Investor role.</p>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {requests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No investor requests found.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="p-4 font-semibold text-gray-700">User</th>
                                <th className="p-4 font-semibold text-gray-700">Message</th>
                                <th className="p-4 font-semibold text-gray-700">Date Applied</th>
                                <th className="p-4 font-semibold text-gray-700">Status</th>
                                <th className="p-4 font-semibold text-gray-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(req => (
                                <tr key={req.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                                    <td className="p-4">
                                        <div className="font-medium">{req.user?.name || req.user?.email || 'Unknown User'}</div>
                                        <div className="text-xs text-gray-500 font-mono mt-1">{req.user?.id}</div>
                                    </td>
                                    <td className="p-4 max-w-md">
                                        <p className="text-sm text-gray-600 break-words">
                                            {req.message || <span className="text-gray-400 italic">No message provided</span>}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm whitespace-nowrap">
                                            {new Date(req.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                            ${req.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                                              req.status === 'DENIED' ? 'bg-red-100 text-red-800' : 
                                              'bg-yellow-100 text-yellow-800'}`}
                                        >
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {req.status === 'PENDING' && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleUpdate(req.id, 'APPROVED')}
                                                    disabled={processingId === req.id}
                                                    className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Approve"
                                                >
                                                    {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => handleUpdate(req.id, 'DENIED')}
                                                    disabled={processingId === req.id}
                                                    className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Deny"
                                                >
                                                    {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <style jsx>{`
              .w-full { width: 100%; }
              .text-left { text-align: left; }
              .border-collapse { border-collapse: collapse; }
              .bg-gray-50 { background-color: #f9fafb; }
              .border-b { border-bottom-width: 1px; }
              .border-gray-200 { border-color: #e5e7eb; }
              .border-gray-100 { border-color: #f3f4f6; }
              .p-4 { padding: 1rem; }
              .font-semibold { font-weight: 600; }
              .text-gray-700 { color: #374151; }
              .text-right { text-align: right; }
              .hover\\:bg-gray-50\\/50:hover { background-color: rgba(249, 250, 251, 0.5); }
              .font-medium { font-weight: 500; }
              .text-xs { font-size: 0.75rem; }
              .text-sm { font-size: 0.875rem; }
              .text-gray-500 { color: #6b7280; }
              .text-gray-600 { color: #4b5563; }
              .text-gray-400 { color: #9ca3af; }
              .font-mono { font-family: monospace; }
              .mt-1 { margin-top: 0.25rem; }
              .max-w-md { max-width: 28rem; }
              .break-words { word-wrap: break-word; }
              .italic { font-style: italic; }
              .whitespace-nowrap { white-space: nowrap; }
              .inline-flex { display: inline-flex; }
              .items-center { align-items: center; }
              .justify-center { justify-content: center; }
              .justify-end { justify-content: flex-end; }
              .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
              .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
              .rounded-full { border-radius: 9999px; }
              .rounded-lg { border-radius: 0.5rem; }
              .bg-green-100 { background-color: #d1fae5; }
              .text-green-800 { color: #065f46; }
              .bg-red-100 { background-color: #fee2e2; }
              .text-red-800 { color: #991b1b; }
              .bg-yellow-100 { background-color: #fef3c7; }
              .text-yellow-800 { color: #92400e; }
              .bg-green-50 { background-color: #ecfdf5; }
              .text-green-600 { color: #059669; }
              .hover\\:bg-green-100:hover { background-color: #d1fae5; }
              .bg-red-50 { background-color: #fef2f2; }
              .text-red-600 { color: #dc2626; }
              .hover\\:bg-red-100:hover { background-color: #fee2e2; }
              .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
              .flex { display: flex; }
              .gap-2 { gap: 0.5rem; }
              .p-1\\.5 { padding: 0.375rem; }
              .disabled\\:opacity-50:disabled { opacity: 0.5; }
              .bg-white { background-color: #ffffff; }
              .rounded-xl { border-radius: 0.75rem; }
              .overflow-hidden { overflow: hidden; }
              .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
              .text-2xl { font-size: 1.5rem; line-height: 2rem; }
              .font-bold { font-weight: 700; }
              .mb-6 { margin-bottom: 1.5rem; }
              .mb-8 { margin-bottom: 2rem; }
              .h-64 { height: 16rem; }
              .animate-spin { animation: spin 1s linear infinite; }
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AdminInvestorVetting;
