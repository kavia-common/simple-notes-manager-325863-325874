import React from "react";
import "./App.css";
import { useNotesFlow } from "./notes/useNotesFlow";

function formatPreview(content) {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return "No content";
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

// PUBLIC_INTERFACE
function App() {
  /** Notes UI entrypoint. Renders sidebar list + editor and binds to notes flow. */
  const {
    state,
    selectedNote,
    draft,
    isDirty,
    selectNote,
    updateDraft,
    createNewNote,
    saveSelected,
    deleteSelected,
    clearError,
  } = useNotesFlow();

  return (
    <div className="appShell">
      <aside className="sidebar" aria-label="Notes list">
        <div className="sidebarHeader">
          <div className="brand">
            <div className="brandMark" aria-hidden="true" />
            <div>
              <div className="brandTitle">Simple Notes</div>
              <div className="brandSubtitle">Manager</div>
            </div>
          </div>

          <button
            className="btn btnPrimary"
            onClick={createNewNote}
            disabled={state.isSaving || state.isLoadingList}
            aria-label="Create new note"
            title="New note"
          >
            + New
          </button>
        </div>

        <div className="sidebarMeta">
          {state.isLoadingList ? (
            <span className="muted">Loading notes…</span>
          ) : (
            <span className="muted">{state.notes.length} notes</span>
          )}
        </div>

        {state.error ? (
          <div className="alert" role="alert">
            <div className="alertText">{state.error}</div>
            <button className="btn btnGhost btnSmall" onClick={clearError}>
              Dismiss
            </button>
          </div>
        ) : null}

        <nav className="noteList" aria-label="Notes">
          {state.notes.map((note) => {
            const isActive = String(note.id) === String(state.selectedId);
            return (
              <button
                key={String(note.id)}
                className={`noteListItem ${isActive ? "active" : ""}`}
                onClick={() => selectNote(note.id)}
                aria-current={isActive ? "true" : "false"}
              >
                <div className="noteTitleRow">
                  <div className="noteTitle">
                    {note.title?.trim() ? note.title : "Untitled"}
                  </div>
                  {isActive && isDirty ? (
                    <span className="pill" title="Unsaved changes">
                      Unsaved
                    </span>
                  ) : null}
                </div>
                <div className="notePreview">{formatPreview(note.content)}</div>
              </button>
            );
          })}
          {!state.isLoadingList && state.notes.length === 0 ? (
            <div className="emptySidebar">
              <div className="emptyTitle">No notes yet</div>
              <div className="emptyText">Create your first note to get started.</div>
            </div>
          ) : null}
        </nav>
      </aside>

      <main className="main" aria-label="Note editor">
        <div className="mainHeader">
          <div className="mainHeaderLeft">
            <div className="pageTitle">
              {selectedNote ? "Edit note" : "Select a note"}
            </div>
            <div className="pageSubtitle">
              {selectedNote
                ? "Changes are saved when you click Save."
                : "Pick a note from the sidebar or create a new one."}
            </div>
          </div>

          <div className="actions">
            <button
              className="btn btnGhost"
              onClick={deleteSelected}
              disabled={!selectedNote || state.isDeleting || state.isSaving}
              aria-label="Delete selected note"
            >
              {state.isDeleting ? "Deleting…" : "Delete"}
            </button>
            <button
              className="btn btnPrimary"
              onClick={saveSelected}
              disabled={!selectedNote || state.isSaving || !isDirty}
              aria-label="Save selected note"
              title={!isDirty ? "No changes to save" : "Save"}
            >
              {state.isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {!selectedNote ? (
          <div className="emptyMain">
            <div className="emptyCard">
              <div className="emptyTitle">Welcome to Simple Notes</div>
              <div className="emptyText">
                Use the sidebar to create and manage notes with a clean, modern workflow.
              </div>
              <button
                className="btn btnPrimary"
                onClick={createNewNote}
                disabled={state.isSaving || state.isLoadingList}
              >
                + Create a note
              </button>
            </div>
          </div>
        ) : (
          <div className="editor">
            <label className="field">
              <span className="label">Title</span>
              <input
                className="input"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="Untitled"
              />
            </label>

            <label className="field fieldGrow">
              <span className="label">Content</span>
              <textarea
                className="textarea"
                value={draft.content}
                onChange={(e) => updateDraft({ content: e.target.value })}
                placeholder="Write your note here…"
              />
            </label>

            <div className="editorFooter">
              <div className="muted">
                {isDirty ? "You have unsaved changes." : "All changes saved."}
              </div>
              <div className="kbdHint">
                <span className="kbd">Tip</span> Use <span className="kbd">Save</span> to persist changes.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
