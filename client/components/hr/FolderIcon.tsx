
import React from 'react';
import { Folder, User, Calendar, FilePlus } from 'lucide-react';

interface FolderIconProps {
    staffName: string;
    staffId: string;
    createdAt: string;
    createdBy: string | null;
    onClick?: () => void;
}

export const FolderIcon = ({ staffName, staffId, createdAt, createdBy, onClick }: FolderIconProps) => {
    return (
        <div
            onClick={onClick}
            className="group flex flex-col items-center p-4 rounded-xl hover:bg-blue-50 cursor-pointer transition-all w-48 text-center"
        >
            <div className="relative mb-3">
                <Folder
                    size={84}
                    className="text-blue-200 fill-blue-200 group-hover:text-blue-300 group-hover:fill-blue-300 transition-colors"
                    strokeWidth={1}
                />
                <div className="absolute inset-0 flex items-center justify-center pt-2">
                    <span className="text-[10px] font-mono text-blue-800 font-bold bg-white/50 px-1 rounded">
                        {staffId}
                    </span>
                </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-1 group-hover:text-blue-700">
                {staffName}
            </h3>

            <div className="text-[10px] text-gray-500 space-y-0.5 w-full">
                <div className="flex items-center justify-center gap-1">
                    <Calendar size={10} />
                    <span>{new Date(createdAt).toLocaleDateString()}</span>
                </div>
                {createdBy && (
                    <div className="flex items-center justify-center gap-1 text-gray-400">
                        <FilePlus size={10} />
                        <span className="truncate max-w-[100px]">By: {createdBy}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
