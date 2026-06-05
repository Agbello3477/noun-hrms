
import React from 'react';
import { Folder, User, Calendar, FilePlus } from 'lucide-react';

interface FolderIconProps {
    staffName: string;
    staffId: string;
    createdAt: string;
    createdBy: string | null;
    onClick?: () => void;
    color?: 'blue' | 'yellow' | 'red';
    role?: string;
    designation?: string;
}

export const FolderIcon = ({ staffName, staffId, createdAt, createdBy, onClick, color = 'blue', role, designation }: FolderIconProps) => {
    let folderClass = "text-blue-200 fill-blue-200 group-hover:text-blue-300 group-hover:fill-blue-300 transition-colors";
    let badgeClass = "text-blue-800 bg-white/50";
    let hoverBgClass = "hover:bg-blue-50";

    if (color === 'red') {
        folderClass = "text-red-300 fill-red-200 group-hover:text-red-400 group-hover:fill-red-300 transition-colors";
        badgeClass = "text-red-800 bg-red-100/60";
        hoverBgClass = "hover:bg-red-50";
    } else if (color === 'yellow') {
        folderClass = "text-yellow-400 fill-yellow-250 group-hover:text-yellow-500 group-hover:fill-yellow-300 transition-colors";
        badgeClass = "text-yellow-900 bg-yellow-100/60";
        hoverBgClass = "hover:bg-yellow-50";
    }

    return (
        <div
            onClick={onClick}
            className={`group flex flex-col items-center p-4 rounded-xl cursor-pointer transition-all w-48 text-center ${hoverBgClass}`}
        >
            <div className="relative mb-3">
                <Folder
                    size={84}
                    className={folderClass}
                    strokeWidth={1}
                />
                <div className="absolute inset-0 flex items-center justify-center pt-2">
                    <span className={`text-[10px] font-mono font-bold px-1 rounded max-w-[70px] truncate inline-block ${badgeClass}`}>
                        {staffId}
                    </span>
                </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-800 line-clamp-1 leading-tight mb-0.5 group-hover:text-blue-700">
                {staffName}
            </h3>

            {role && (
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
                    {role.replace(/_/g, ' ')}
                </div>
            )}

            {designation && (
                <div className="text-[11px] text-gray-500 font-medium mb-1 truncate max-w-full">
                    {designation}
                </div>
            )}

            <div className="text-[10px] text-gray-400 space-y-0.5 w-full">
                <div className="flex items-center justify-center gap-1">
                    <Calendar size={10} />
                    <span>{new Date(createdAt).toLocaleDateString()}</span>
                </div>
                {createdBy && (
                    <div className="flex items-center justify-center gap-1">
                        <FilePlus size={10} />
                        <span className="truncate max-w-[100px]">By: {createdBy}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
