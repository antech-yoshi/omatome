import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PRESET_SERVICES, SERVICE_CATEGORIES } from '@shared/constants';
import ServiceIcon from '../ServiceIcon';

interface ServiceAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (serviceId: string, label: string, customUrl?: string) => void;
}

export default function ServiceAddModal({ isOpen, onClose, onAdd }: ServiceAddModalProps) {
  const [step, setStep] = useState<'select' | 'configure' | 'custom'>('select');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceUrl, setWorkspaceUrl] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && step === 'select') {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, step]);

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_SERVICES;
    const q = searchQuery.toLowerCase();
    return PRESET_SERVICES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.category && SERVICE_CATEGORIES[s.category]?.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, typeof filteredServices> = {};
    for (const service of filteredServices) {
      const cat = service.category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(service);
    }
    return groups;
  }, [filteredServices]);

  if (!isOpen) return null;

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const service = PRESET_SERVICES.find((s) => s.id === serviceId);
    setLabel(service?.name ?? '');
    setWorkspaceUrl('');
    setStep('configure');
  };

  const handleSelectCustom = () => {
    setSelectedServiceId('custom');
    setLabel('');
    setCustomUrl('');
    setStep('custom');
  };

  const handleAdd = () => {
    if (step === 'custom') {
      if (label.trim() && customUrl.trim()) {
        let url = customUrl.trim();
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
        onAdd('custom', label.trim(), url);
        handleClose();
      }
    } else {
      if (selectedServiceId && label.trim()) {
        // For Slack, use the workspace URL if provided
        if (selectedServiceId === 'slack' && workspaceUrl.trim()) {
          let url = workspaceUrl.trim();
          if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
          }
          // Ensure it ends with slack.com pattern
          if (!url.includes('.slack.com')) {
            url = `https://${url.replace(/^https?:\/\//, '')}.slack.com/`;
          }
          onAdd(selectedServiceId, label.trim(), url);
        } else {
          onAdd(selectedServiceId, label.trim());
        }
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedServiceId('');
    setLabel('');
    setCustomUrl('');
    setWorkspaceUrl('');
    setSearchQuery('');
    onClose();
  };

  const isCustomUrlValid = customUrl.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={handleClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[440px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {step === 'select' ? 'Add Service' : 'Configure Account'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'select' ? (
            <div>
              {/* Search input */}
              <div className="px-6 pt-4 pb-2 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search services..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>

              {/* Service list */}
              <div className="px-4 pb-4">
                {/* Other Links - custom URL */}
                {(!searchQuery.trim() || 'custom link url other'.includes(searchQuery.toLowerCase())) && (
                  <div className="mt-3 first:mt-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Other Links
                    </div>
                    <div className="space-y-0.5">
                      <button
                        onClick={handleSelectCustom}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className="w-8 h-8 shrink-0 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Custom Link</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">Add any website by URL</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Preset services */}
                {Object.entries(groupedServices).map(([category, services]) => (
                  <div key={category} className="mt-3 first:mt-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {SERVICE_CATEGORIES[category] ?? category}
                    </div>
                    <div className="space-y-0.5">
                      {services.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => handleSelectService(service.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <ServiceIcon serviceId={service.id} className="w-8 h-8 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{service.name}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{service.url}</div>
                          </div>
                          <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredServices.length === 0 && searchQuery.trim() && !('custom link url other'.includes(searchQuery.toLowerCase())) && (
                  <div className="text-center py-8 text-sm text-gray-400">
                    No services found
                  </div>
                )}
              </div>
            </div>
          ) : step === 'custom' ? (
            <div className="p-6 space-y-5">
              {/* Custom link icon */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-8 h-8 shrink-0 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Custom Link</span>
              </div>

              {/* URL input */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  URL
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  autoFocus
                />
              </div>

              {/* Label input */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Account Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. My Website"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setStep('select');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!label.trim() || !isCustomUrlValid}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Account
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Selected service preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <ServiceIcon serviceId={selectedServiceId} className="w-8 h-8" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {PRESET_SERVICES.find((s) => s.id === selectedServiceId)?.name}
                </span>
              </div>

              {/* Label input */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Account Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Project A, Personal"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                />
              </div>

              {/* Slack workspace URL */}
              {selectedServiceId === 'slack' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Workspace URL
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">https://</span>
                    <input
                      type="text"
                      value={workspaceUrl}
                      onChange={(e) => setWorkspaceUrl(e.target.value)}
                      placeholder="your-workspace"
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd();
                      }}
                    />
                    <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">.slack.com</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                    Leave empty to open Slack's default page
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setStep('select');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!label.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
