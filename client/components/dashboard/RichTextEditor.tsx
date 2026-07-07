'use client';

import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Heading1, Heading2, Link, Table, Eraser, Outdent, Indent, 
  Type
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isTypingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false
  });

  // Sync external value changes into the editor (only if the user is not actively typing)
  useEffect(() => {
    if (editorRef.current && !isTypingRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const commandStatesTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (commandStatesTimerRef.current) clearTimeout(commandStatesTimerRef.current);
    };
  }, []);

  // Update parent state with a debounce to prevent rendering lag during typing
  const handleInput = () => {
    isTypingRef.current = true;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
      isTypingRef.current = false;
    }, 350); // 350ms debounce guarantees typing is fluid and lag-free
  };

  // Immediate sync on blur to make sure the latest edits are captured before submission
  const handleBlur = () => {
    setIsFocused(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    isTypingRef.current = false;
  };

  const checkCommandStates = () => {
    if (typeof document === 'undefined') return;
    setActiveStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      justifyFull: document.queryCommandState('justifyFull'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList')
    });
  };

  const debouncedCheckCommandStates = () => {
    if (commandStatesTimerRef.current) {
      clearTimeout(commandStatesTimerRef.current);
    }
    commandStatesTimerRef.current = setTimeout(() => {
      checkCommandStates();
    }, 300); // 300ms debounce prevents rendering updates during active typing
  };

  const execCommand = (command: string, arg: string = '') => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false, arg);
    
    // Immediate input update on toolbar action
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    
    checkCommandStates();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const insertLink = () => {
    const url = prompt('Enter the link URL (e.g., https://example.com):');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertTable = () => {
    const rows = prompt('Enter number of rows:', '3');
    const cols = prompt('Enter number of columns:', '3');
    if (rows && cols) {
      const rNum = parseInt(rows);
      const cNum = parseInt(cols);
      if (isNaN(rNum) || isNaN(cNum)) return;
      
      let tableHtml = '<table style="width:100%; border-collapse:collapse; border:1px solid #ddd; margin:10px 0;">';
      for (let i = 0; i < rNum; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < cNum; j++) {
          tableHtml += '<td style="border:1px solid #ddd; padding:8px; text-align:left;">Cell</td>';
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table><p><br></p>';
      execCommand('insertHTML', tableHtml);
    }
  };

  const buttonClass = (isActive: boolean) => 
    `p-1.5 rounded-lg transition-colors duration-150 flex items-center justify-center ${
      isActive 
        ? 'bg-indigo-100 text-indigo-700 font-bold' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm bg-white transition-all duration-200 ${
      isFocused ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-gray-200'
    }`}>
      {/* Premium Word-Like Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1 items-center select-none">
        
        {/* Style Selection */}
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<p>')}
          className="px-2 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
          title="Normal Paragraph"
        >
          Normal
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h1>')}
          className="px-2 py-1 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded hover:bg-gray-50"
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="px-2 py-1 text-xs font-bold text-gray-850 bg-white border border-gray-200 rounded hover:bg-gray-50"
          title="Heading 2"
        >
          H2
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Text Formats */}
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
        <button
          type="button"
          onClick={() => execCommand('strikeThrough')}
          className={buttonClass(activeStates.strikeThrough)}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Font Color & Highlight */}
        <button
          type="button"
          onClick={() => {
            const color = prompt('Enter a hex color or name (e.g., #ff0000 or red):', '#000000');
            if (color) execCommand('foreColor', color);
          }}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center gap-0.5"
          title="Text Color"
        >
          <Type size={15} />
          <span className="w-2.5 h-2.5 rounded bg-black border border-gray-300"></span>
        </button>
        <button
          type="button"
          onClick={() => {
            const color = prompt('Enter a highlight color (e.g., yellow, #ffff00):', 'yellow');
            if (color) execCommand('hiliteColor', color);
          }}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center gap-0.5"
          title="Highlight Color"
        >
          <Eraser size={14} className="text-yellow-600 animate-pulse" />
          <span className="w-2.5 h-2.5 rounded bg-yellow-300 border border-gray-300"></span>
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Alignment */}
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

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Lists & Indentation */}
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
        <button
          type="button"
          onClick={() => execCommand('outdent')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 transition-colors"
          title="Decrease Indent"
        >
          <Outdent size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('indent')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 transition-colors"
          title="Increase Indent"
        >
          <Indent size={15} />
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Inserts & Clear */}
        <button
          type="button"
          onClick={insertLink}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Insert Link"
        >
          <Link size={15} />
        </button>
        <button
          type="button"
          onClick={insertTable}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Insert Microsoft Word-style Table"
        >
          <Table size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('removeFormat')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="Clear All Formatting"
        >
          <Eraser size={15} />
        </button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Undo/Redo */}
        <button
          type="button"
          onClick={() => execCommand('undo')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('redo')}
          className="p-1.5 rounded-lg text-gray-650 hover:bg-gray-100 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={15} />
        </button>
      </div>

      {/* Word-like Editor Content Area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyUp={debouncedCheckCommandStates}
          onMouseUp={debouncedCheckCommandStates}
          onFocus={() => setIsFocused(true)}
          className="p-5 min-h-[260px] max-h-[600px] overflow-y-auto outline-none text-sm text-gray-800 prose max-w-none focus:outline-none bg-white leading-relaxed font-sans"
          style={{
            minHeight: '260px',
            fontFamily: 'Arial, sans-serif'
          }}
        />
        {!value && placeholder && (
          <div className="absolute top-5 left-5 text-gray-400 text-sm pointer-events-none select-none italic font-light">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
