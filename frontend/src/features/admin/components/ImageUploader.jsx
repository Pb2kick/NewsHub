/*
 * Changes:
 * - Added a reusable drag-and-drop image uploader with preview and remove action.
 */
import React, { useRef } from 'react';
import { CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';

/**
 * Drag-and-drop image uploader with preview support.
 * @param {{
 *   value: string,
 *   onChange: (url: string) => void,
 *   error?: string,
 *   label?: string,
 *   isUploading?: boolean,
 *   onUpload: (file: File) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function ImageUploader({ value, onChange, error, label, isUploading, onUpload }) {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return;
    }
    onUpload(file);
  };

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    handleFile(file);
  };

  return (
    <div>
      {label ? <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label> : null}
      <div
        className={`relative flex items-center justify-center border-2 border-dashed rounded-xl p-4 text-slate-500 transition-colors cursor-pointer ${
          error ? 'border-rose-500' : 'border-slate-300 hover:border-slate-400'
        }`}
        onClick={handleClick}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          type="file"
          accept="image/*"
          ref={inputRef}
          onChange={handleInputChange}
          className="hidden"
        />
        {isUploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        ) : value ? (
          <div className="w-full">
            <div className="relative">
              <img src={value} alt="Uploaded preview" className="h-[120px] w-full object-cover rounded-lg" />
              <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-green-500 bg-white rounded-full" />
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange('');
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-2">
            <UploadCloud className="w-6 h-6 text-slate-400" />
            <p className="text-sm text-slate-500">Drag & drop an image or click to browse</p>
          </div>
        )}
      </div>
      {error ? <p className="text-xs text-rose-600 mt-1">{error}</p> : null}
    </div>
  );
}
