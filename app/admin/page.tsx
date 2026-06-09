"use client";

import { useState, useEffect } from "react";

export default function AdminPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [tempContent, setTempContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  const STORAGE_KEY = "protocol_admin_summary_content";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || "";
    setSummaryContent(saved);
    setLoaded(true);
  }, []);

  const handleSave = () => {
    setSummaryContent(tempContent);
    localStorage.setItem(STORAGE_KEY, tempContent);
    setIsEditing(false);
  };

  if (!loaded) return <div style={{ background: "#f5f5f5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Segoe UI" }}>Loading...</div>;

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: "20px", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#333" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header with Edit Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ color: "#1a1a1a", borderBottom: "3px solid #0066cc", paddingBottom: "10px", margin: "0" }}>
            RAFAEL PROTOCOL SUMMARY
          </h1>
          <button
            onClick={() => { setIsEditing(!isEditing); setTempContent(summaryContent); }}
            style={{
              background: isEditing ? "#dc3545" : "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {isEditing ? "Cancel" : "✎ Edit"}
          </button>
        </div>

        {/* Edit Mode */}
        {isEditing ? (
          <div style={{ background: "#fff", padding: "20px", borderRadius: "5px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <textarea
              value={tempContent}
              onChange={e => setTempContent(e.target.value)}
              placeholder="Paste your protocol summary HTML or text here..."
              style={{
                width: "100%",
                minHeight: "500px",
                fontFamily: "monospace",
                fontSize: "13px",
                padding: "15px",
                border: "1px solid #ddd",
                borderRadius: "5px",
                boxSizing: "border-box",
                lineHeight: "1.5",
              }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  background: "#28a745",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                💾 Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  flex: 1,
                  background: "#6c757d",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  padding: "12px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Display Mode - Styled like HTML */
          <div>
            {!summaryContent ? (
              <div style={{
                background: "#fff",
                padding: "40px",
                textAlign: "center",
                borderRadius: "5px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}>
                <p style={{ color: "#999", fontSize: "16px" }}>No summary yet. Click "Edit" to add your protocol summary.</p>
              </div>
            ) : (
              <div style={{ background: "#fff", padding: "30px", borderRadius: "5px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                {/* Try to render as HTML if it looks like HTML, otherwise as text */}
                {summaryContent.includes("<") ? (
                  <div dangerouslySetInnerHTML={{ __html: summaryContent }} style={{ 
                    lineHeight: "1.8",
                    fontSize: "14px",
                  }} />
                ) : (
                  <div style={{
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    lineHeight: "1.8",
                    fontSize: "14px",
                  }}>
                    {summaryContent}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "30px", textAlign: "center", fontSize: "12px", color: "#666" }}>
          Protocol Dashboard | Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
