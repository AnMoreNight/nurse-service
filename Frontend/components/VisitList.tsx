"use client";

import React, { useState } from 'react';
import { VisitWithStaff, CompanySettings } from '@/lib/types';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getColorStyles } from '@/lib/utils';

interface VisitListProps {
  visits: VisitWithStaff[];
  onSelectVisit: (visit: VisitWithStaff) => void;
  companySettings: CompanySettings;
}

const ITEMS_PER_PAGE = 10;

export const VisitList: React.FC<VisitListProps> = ({ visits, onSelectVisit, companySettings }) => {
  const [currentPage, setCurrentPage] = useState(1);

  if (visits.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
              <p>該当するスケジュールが見つかりませんでした。</p>
          </div>
      );
  }

  const sortedVisits = [...visits].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
  });

  const totalPages = Math.ceil(sortedVisits.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedVisits = sortedVisits.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  const getStatusStyleObj = (statusKey: string) => {
      const config = companySettings.visitStatuses.find(s => s.key === statusKey);
      const color = config ? config.color : 'blue';
      const styles = getColorStyles(color);
      return {
          backgroundColor: styles.bgLight,
          color: styles.text,
          borderColor: styles.borderLight
      };
  };

  const getStatusLabel = (statusKey: string) => {
      const config = companySettings.visitStatuses.find(s => s.key === statusKey);
      return config ? config.label : statusKey;
  };

  return (
    <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th className="py-3 px-4 font-bold text-gray-600 text-xs border-b">日付</th>
                        <th className="py-3 px-4 font-bold text-gray-600 text-xs border-b">時間</th>
                        <th className="py-3 px-4 font-bold text-gray-600 text-xs border-b">患者名</th>
                        <th className="py-3 px-4 font-bold text-gray-600 text-xs border-b">担当スタッフ</th>
                        <th className="py-3 px-4 font-bold text-gray-600 text-xs border-b">ステータス</th>
                        <th className="py-3 px-4 font-bold text-gray-600 text-xs border-b">メモ</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedVisits.map((visit, index) => {
                        const dateObj = new Date(visit.date);
                        const dateStr = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
                        
                        return (
                            <tr 
                                key={visit.id + visit.date + index}
                                onClick={() => onSelectVisit(visit)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0 group"
                            >
                                <td className="py-3 px-4 text-sm text-gray-700 font-medium whitespace-nowrap">
                                    {dateStr}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                                    {visit.startTime} - {visit.endTime}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-800 font-bold">
                                    {visit.patientName || '名称未設定'}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        {visit.staffMembers && visit.staffMembers.length > 0 ? (
                                            <>
                                                <div className="flex -space-x-1.5">
                                                    {visit.staffMembers.map(s => (
                                                        <div
                                                            key={s.id}
                                                            className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[10px] font-bold text-white"
                                                            style={{ backgroundColor: getColorStyles(s.color).bg }}
                                                            title={s.name}
                                                        >
                                                            {s.avatar}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-xs truncate max-w-[150px]">
                                                    {visit.staffMembers.map(s => s.name).join(', ')}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-gray-400 italic">担当なし</span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-sm">
                                    <span
                                        className="px-2 py-0.5 rounded text-xs font-medium border"
                                        style={getStatusStyleObj(visit.status)}
                                    >
                                        {getStatusLabel(visit.status)}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-500 truncate max-w-[200px]">
                                    {visit.notes}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

        {totalPages > 1 && (
            <div className="p-3 border-t bg-gray-50 flex justify-between items-center text-sm text-gray-600">
                <div>
                    {visits.length} 件中 {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, visits.length)} 件を表示
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handlePrevPage} 
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="flex items-center px-2 font-bold">
                        {currentPage} / {totalPages}
                    </span>
                    <button 
                        onClick={handleNextPage} 
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};
