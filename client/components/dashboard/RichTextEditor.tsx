'use client';

import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Heading1, Heading2
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false
  });

  // Sync value from props to editor only if different to prevent cursor jump
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const checkCommandStates = () => {
    if (typeof document === 'undefined') return;
    setActiveStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      justifyFull: document.queryCommandState('justifyFull'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList')
    });
  };

  const execCommand = (command: string, arg: string = '') => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false, arg);
    handleInput();
    checkCommandStates();
    
    // Maintain focus on the editor div
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const buttonClass = (isActive: boolean) => 
    `p-1.5 rounded-lg transition-colors duration-150 ${
      isActive 
        ? 'bg-blue-100 text-blue-700 font-bold' 
        : 'text-gray-650 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm bg-white transition-all duration-200 ${
      isFocused ? 'border-blue-500 ring-2 ring-blue-50' : 'border-gray-200'
    }`}>
      {/* Toolbar */}
      <div className="bg-gray-50/80 border-b border-gray-200 p-2 flex flex-wrap gap-1 items-center select-none">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={buttonClass(activeStates.bold)}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={buttonClass(activeStates.italic)}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className={buttonClass(activeStates.underline)}
          title="Underline (Ctrl+U)"
        >
          <Underline size={15} />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h1>')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Heading 1"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Heading 2"
        >
          <Heading2 size={15} />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className={buttonClass(activeStates.justifyLeft)}
          title="Align Left"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className={buttonClass(activeStates.justifyCenter)}
          title="Align Center"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className={buttonClass(activeStates.justifyRight)}
          title="Align Right"
        >
          <AlignRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('justifyFull')}
          className={buttonClass(activeStates.justifyFull)}
          title="Justify"
        >
          <AlignJustify size={15} />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className={buttonClass(activeStates.insertUnorderedList)}
          title="Bullet List"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className={buttonClass(activeStates.insertOrderedList)}
          title="Numbered List"
        >
          <ListOrdered size={15} />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('undo')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Undo"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('redo')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Redo"
        >
          <Redo size={15} />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyUp={checkCommandStates}
          onMouseUp={checkCommandStates}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="p-4 min-h-[260px] max-h-[500px] overflow-y-auto outline-none text-sm text-black prose max-w-none focus:outline-none"
        />
        {!value && placeholder && (
          <div className="absolute top-4 left-4 text-gray-400 text-sm pointer-events-none select-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
