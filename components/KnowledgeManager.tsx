'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeCategory,
} from '@/lib/knowledge-types';

type KnowledgeListItem = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  filename: string;
  contentType: string;
  fileUrl: string;
  notes: string | null;
  active: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  textPreview: string;
  textLength: number;
};

export function KnowledgeManager() {
  const [documents, setDocuments] = useState<KnowledgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory>('guidelines');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/knowledge');
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to load documents');
      }

      const data = (await response.json()) as { documents: KnowledgeListItem[] };
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!file) {
      setError('Choose a file to upload.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('notes', notes);
      formData.append('file', file);

      const response = await fetch('/api/admin/knowledge', {
        method: 'POST',
        body: formData,
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        document?: KnowledgeListItem;
      };

      if (!response.ok) {
        throw new Error(body.error ?? 'Upload failed');
      }

      setSuccess(
        `Uploaded "${body.document?.title ?? title}". AI underwriting will use this material on the next analysis.`
      );
      setTitle('');
      setNotes('');
      setFile(null);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setError(null);

    const response = await fetch(`/api/admin/knowledge/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Failed to update document');
      return;
    }

    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, active } : doc))
    );
  }

  async function removeDocument(id: string, docTitle: string) {
    if (!window.confirm(`Remove "${docTitle}" from AI knowledge?`)) return;

    setError(null);
    const response = await fetch(`/api/admin/knowledge/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'Failed to delete document');
      return;
    }

    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setSuccess(`Removed "${docTitle}".`);
  }

  const activeCount = documents.filter((doc) => doc.active).length;

  return (
    <div className="knowledge-manager">
      <section className="knowledge-upload-card">
        <h2>Upload underwriting knowledge</h2>
        <p className="form-hint">
          Supervisors can upload guidelines, procedures, contract documents, and
          reference material. Extracted text is injected into Grok AI prompts to
          improve underwriting decisions.
        </p>

        <form className="knowledge-upload-form" onSubmit={handleUpload}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="knowledge-title">Title</label>
              <input
                id="knowledge-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Claims Underwriting Process"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="knowledge-category">Category</label>
              <select
                id="knowledge-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
              >
                {KNOWLEDGE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {KNOWLEDGE_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="knowledge-notes">Supervisor notes (optional)</label>
            <textarea
              id="knowledge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="When to apply this document, exceptions, or emphasis for the AI."
              rows={3}
            />
          </div>

          <div className="form-field">
            <label htmlFor="knowledge-file">Document</label>
            <input
              id="knowledge-file"
              type="file"
              accept=".pdf,.txt,.md,.html,.htm,.json,text/plain,text/html,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <span className="form-hint">PDF, TXT, MD, HTML, or JSON — max 10 MB.</span>
          </div>

          <button type="submit" className="button" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload to AI knowledge base'}
          </button>
        </form>
      </section>

      <section className="knowledge-list-card">
        <div className="knowledge-list-header">
          <h2>Knowledge base</h2>
          <span className="knowledge-count">
            {activeCount} active / {documents.length} total
          </span>
        </div>

        {loading && <p className="form-hint">Loading documents…</p>}
        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        {!loading && documents.length === 0 && (
          <p className="form-hint">
            No documents yet. Upload the Claims Underwriting Process PDF or plan
            registration HTML to sharpen AI decisions.
          </p>
        )}

        <ul className="knowledge-list">
          {documents.map((doc) => (
            <li key={doc.id} className={`knowledge-item ${doc.active ? '' : 'inactive'}`}>
              <div className="knowledge-item-main">
                <div className="knowledge-item-title">
                  <strong>{doc.title}</strong>
                  <span className="knowledge-category-badge">
                    {KNOWLEDGE_CATEGORY_LABELS[doc.category]}
                  </span>
                  {!doc.active && (
                    <span className="knowledge-inactive-badge">Inactive</span>
                  )}
                </div>
                <p className="knowledge-meta">
                  {doc.filename} · {doc.textLength.toLocaleString()} chars extracted ·{' '}
                  {new Date(doc.createdAt).toLocaleString()}
                </p>
                {doc.textPreview && (
                  <p className="knowledge-preview">{doc.textPreview}…</p>
                )}
                {doc.notes && <p className="knowledge-notes">Notes: {doc.notes}</p>}
              </div>

              <div className="knowledge-item-actions">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="link-button">
                  View file
                </a>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => toggleActive(doc.id, !doc.active)}
                >
                  {doc.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="link-button danger"
                  onClick={() => removeDocument(doc.id, doc.title)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}