// src/components/FileUploader.tsx

import React, { useState, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Loader2, X, FileText, File as FileIcon, AlertCircle, Upload } from 'lucide-react';

/* ---------- Utility helpers ---------- */

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  'application/json': ['.json']
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const isValidFileType = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? ['pdf', 'txt', 'csv', 'md', 'json'].includes(ext) : false;
};

const getFileDisplayName = (name: string) => {
  if (name.length <= 25) return name;
  const ext = name.split('.').pop();
  const base = name.substring(0, name.lastIndexOf('.'));
  return `${base.substring(0, 15)}...${ext ? `.${ext}` : ''}`;
};

const formatFileSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ---------- File reading helpers ---------- */

const readAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(file);
  });

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

/* ---------- Type definitions ---------- */

export interface ProcessedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // For PDFs: data URL (base64); for text: raw text
}

interface FileUploaderProps {
  onFileProcess: (files: ProcessedFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedFileTypes?: Record<string, string[]>;
  className?: string;
}

/* ---------- Component ---------- */

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileProcess,
  disabled = false,
  maxFiles = 5,
  maxFileSize = MAX_FILE_SIZE,
  acceptedFileTypes = ACCEPTED_FILE_TYPES,
  className = ''
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [fileRejections, setFileRejections] = useState<FileRejection[]>([]);

  const generateFileId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2);

  /* ---------- Dropzone ---------- */
  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        setFileRejections(rejected);
        setTimeout(() => setFileRejections([]), 5000);
      }

      if (files.length + accepted.length > maxFiles) {
        setProcessingError(`You can only upload up to ${maxFiles} files at a time.`);
        return;
      }

      const valid = accepted.filter(f => {
        const okType = isValidFileType(f);
        const okSize = f.size <= maxFileSize;
        if (!okType || !okSize) {
          setProcessingError(
            !okType
              ? `File "${f.name}" has an unsupported format.`
              : `File "${f.name}" exceeds ${formatFileSize(maxFileSize)}.`
          );
          return false;
        }
        return true;
      });

      if (!valid.length) return;

      if (processingError) setProcessingError(null);
      setFiles(prev => [...prev, ...valid]);

      await processFiles(valid);
    },
    [files, maxFiles, maxFileSize, processingError]
  );

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } =
    useDropzone({
      onDrop,
      disabled: disabled || processing || files.length >= maxFiles,
      accept: acceptedFileTypes,
      maxSize: maxFileSize
    });

  /* ---------- File processing (OpenRouter path) ---------- */

  const processFiles = async (toProcess: File[]) => {
    setProcessing(true);
    setProcessingProgress(0);

    const processed: ProcessedFile[] = [];
    const failed: string[] = [];

    for (let i = 0; i < toProcess.length; i++) {
      const file = toProcess[i];
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      setProcessingProgress(Math.round((i / toProcess.length) * 100));

      try {
        let content = '';

        if (isPdf) {
          // For PDFs: produce base64 data URL to send to OpenRouter file-parser
          content = await readAsDataUrl(file);
        } else {
          // For text-like formats: keep raw text
          content = await readAsText(file);
        }

        processed.push({
          id: generateFileId(),
          name: file.name,
          size: file.size,
          type: file.type || (isPdf ? 'application/pdf' : ''),
          content
        });
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
        failed.push(file.name);
      }

      setProcessingProgress(Math.round(((i + 1) / toProcess.length) * 100));
    }

    if (failed.length) {
      setProcessingError(
        `Failed to process ${failed.length} file(s): ${failed.join(', ')}`
      );
      setFiles(prev => prev.filter(f => !failed.includes(f.name)));
    }

    if (processed.length) {
      onFileProcess(processed);
    } else if (toProcess.length) {
      setProcessingError('Could not process any of the selected files.');
    }

    setProcessing(false);
    setProcessingProgress(100);
  };

  /* ---------- UI helpers ---------- */

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    if (processingError) setProcessingError(null);
  };

  const clearFiles = () => {
    setFiles([]);
    setProcessingError(null);
  };

  /* ---------- Render ---------- */

  const remainingFiles = maxFiles - files.length;

  return (
    <div className={cn('w-full', className)} aria-label="File uploader">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-all',
          'flex flex-col items-center justify-center text-center',
          isDragActive && isDragAccept && 'border-green-500 bg-green-50 dark:bg-green-900/10',
          isDragActive && isDragReject && 'border-red-500 bg-red-50 dark:bg-red-900/10',
          !isDragActive &&
            'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
          (disabled || processing || files.length >= maxFiles) && 'opacity-50 cursor-not-allowed',
          !disabled && files.length < maxFiles && !processing && 'cursor-pointer',
          'h-28'
        )}
        aria-live="polite"
      >
        <input {...getInputProps()} aria-label="File input" className="sr-only" />

        {isDragActive ? (
          isDragAccept ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">Drop the files here ...</p>
          ) : (
            <p className="text-sm text-red-500">Some files are not supported!</p>
          )
        ) : (
          <>
            <Upload size={20} className="mb-2 text-gray-500 dark:text-gray-400" />
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Supported formats: PDF, TXT, CSV, MD, JSON (max {formatFileSize(maxFileSize)})
            </p>
            {files.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {files.length} / {maxFiles} files
              </p>
            )}
          </>
        )}
      </div>

      {/* Rejection errors */}
      {fileRejections.length > 0 && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">The following files couldn't be added:</p>
            <ul className="list-disc list-inside text-xs mt-1">
              {fileRejections.map(({ file, errors }) => (
                <li key={file.name}>
                  {file.name} - {errors[0].message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Processing / Error messages */}
      {processingError && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{processingError}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploaded files</h3>
            <button
              onClick={clearFiles}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              disabled={processing}
              aria-label="Clear all files"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2" role="list">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800"
                role="listitem"
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  {file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? (
                    <FileText size={16} className="text-red-500 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <FileIcon size={16} className="text-blue-500 flex-shrink-0" aria-hidden="true" />
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={file.name}>
                      {getFileDisplayName(file.name)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(index)}
                  disabled={processing}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-full"
                  aria-label={`Remove file: ${file.name}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {processing && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-center">
            <Loader2 size={16} className="animate-spin mr-2 text-blue-500" aria-hidden="true" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Preparing files... ({processingProgress}%)
            </span>
          </div>
          <label htmlFor="file-processing-progress" className="sr-only">
            File processing progress
          </label>
          <progress
            id="file-processing-progress"
            className="w-full h-1.5 mt-2"
            value={processingProgress}
            max={100}
            aria-valuetext={`${processingProgress}%`}
          />
        </div>
      )}

      {files.length >= maxFiles && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Maximum number of files reached. Remove some files to upload more.
        </p>
      )}

      {remainingFiles <= 0 && processing && (
        <p className="sr-only">
          All allowed files are being prepared. Please wait until completion.
        </p>
      )}
    </div>
  );
};

export default FileUploader;
