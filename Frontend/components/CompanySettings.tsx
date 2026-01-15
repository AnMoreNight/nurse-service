"use client";

import React, { useState, useEffect } from 'react';
import { CompanySettings } from '@/lib/types';
import { Settings, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

interface CompanySettingsProps {
  settings: CompanySettings;
  isLoading?: boolean;
  onSave: (settings: CompanySettings) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const CompanySettingsView: React.FC<CompanySettingsProps> = ({ settings, isLoading = false, onSave, onDirtyChange }) => {
  const { showConfirm } = useModal();
  const [visitStatuses, setVisitStatuses] = useState(settings.visitStatuses);
  const [jobTitles, setJobTitles] = useState(settings.jobTitles);

  // New Status Form State
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('blue');

  // New Job Title Form State
  const [newJobTitle, setNewJobTitle] = useState('');

  // Sync with settings prop when it changes
  useEffect(() => {
    setVisitStatuses(settings.visitStatuses);
    setJobTitles(settings.jobTitles);
  }, [settings]);

  // Updated Default Keys based on new requirements
  const DEFAULT_KEYS = ['REGULAR_NURSE', 'REGULAR_REHAB', 'EMERGENCY', 'OTHER', 'CANCELLED'];

  // Detect changes
  useEffect(() => {
    if (onDirtyChange) {
      const isStatusChanged = JSON.stringify(visitStatuses) !== JSON.stringify(settings.visitStatuses);
      const isJobTitlesChanged = JSON.stringify(jobTitles) !== JSON.stringify(settings.jobTitles);
      onDirtyChange(isStatusChanged || isJobTitlesChanged);
    }
  }, [visitStatuses, jobTitles, settings, onDirtyChange]);

  const handleStatusChange = (index: number, field: 'label' | 'color', value: string) => {
    const updated = [...visitStatuses];
    updated[index] = { ...updated[index], [field]: value };
    setVisitStatuses(updated);
  };

  const handleAddStatus = () => {
    if (!newStatusLabel.trim()) return;
    const newKey = `CUSTOM_${Date.now()}`;
    setVisitStatuses([...visitStatuses, { key: newKey, label: newStatusLabel, color: newStatusColor }]);
    setNewStatusLabel('');
    setNewStatusColor('blue');
  };

  const handleDeleteStatus = async (key: string) => {
    const confirmed = await showConfirm('このステータスを削除しますか？');
    if (confirmed) {
      setVisitStatuses(visitStatuses.filter(s => s.key !== key));
    }
  };

  const handleAddJobTitle = () => {
    if (newJobTitle.trim() && !jobTitles.includes(newJobTitle.trim())) {
      setJobTitles([...jobTitles, newJobTitle.trim()]);
      setNewJobTitle('');
    }
  };

  const handleDeleteJobTitle = (title: string) => {
    setJobTitles(jobTitles.filter(t => t !== title));
  };

  const handleSave = () => {
    onSave({
      visitStatuses,
      jobTitles
    });
  };

  const colorOptions = [
    { val: 'blue', label: '青' },
    { val: 'red', label: '赤' },
    { val: 'orange', label: '橙' },
    { val: 'green', label: '緑' },
    { val: 'purple', label: '紫' },
    { val: 'gray', label: '灰' },
    { val: 'teal', label: '青緑' },
    { val: 'emerald', label: 'エメラルド' },
    { val: 'rose', label: 'ローズ' },
    { val: 'amber', label: '琥珀' },
    { val: 'cyan', label: 'シアン' },
    { val: 'indigo', label: 'インディゴ' },
  ];

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto flex flex-col">
      <div className="p-6 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-600" />
          詳細設定
        </h2>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-bold shadow-md active:scale-95"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              設定を保存
            </>
          )}
        </button>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-10">

        {/* Visit Status Settings */}
        <section>
          <h3 className="text-lg font-bold text-gray-700 mb-4 border-l-4 border-blue-500 pl-3">
            訪問の種類（ステータス）設定
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            カレンダーやリストに表示される訪問の種類名と色をカスタマイズできます。
          </p>
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">表示ラベル</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase w-48">表示色</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase w-32 text-center">プレビュー</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase w-20 text-center">削除</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visitStatuses.map((status, index) => (
                  <tr key={status.key} className="hover:bg-white">
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={status.label}
                        onChange={(e) => handleStatusChange(index, 'label', e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                        value={status.color}
                        onChange={(e) => handleStatusChange(index, 'color', e.target.value)}
                      >
                        {colorOptions.map(c => (
                          <option key={c.val} value={c.val}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded text-xs font-bold border bg-${status.color}-100 text-${status.color}-700 border-${status.color}-300`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteStatus(status.key)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Add New Status Row */}
                <tr className="bg-blue-50/50">
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      placeholder="新しいステータス名"
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                      value={newStatusColor}
                      onChange={(e) => setNewStatusColor(e.target.value)}
                    >
                      {colorOptions.map(c => (
                        <option key={c.val} value={c.val}>{c.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded text-xs font-bold border bg-${newStatusColor}-100 text-${newStatusColor}-700 border-${newStatusColor}-300 opacity-70`}>
                      {newStatusLabel || 'プレビュー'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={handleAddStatus}
                      disabled={!newStatusLabel.trim()}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Job Title Settings */}
        <section>
          <h3 className="text-lg font-bold text-gray-700 mb-4 border-l-4 border-emerald-500 pl-3">
            職種マスター設定
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            スタッフ登録時に選択できる職種を管理します。
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            {jobTitles.map(title => (
              <div key={title} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-slate-700 text-sm font-medium group hover:border-red-300 transition-colors">
                {title}
                <button
                  onClick={() => handleDeleteJobTitle(title)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="新しい職種名 (例: 作業療法士)"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddJobTitle()}
            />
            <button
              onClick={handleAddJobTitle}
              disabled={!newJobTitle.trim()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};
