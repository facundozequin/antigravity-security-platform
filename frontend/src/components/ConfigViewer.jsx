import React from 'react'
export default function ConfigViewer({ filename, content }) {
    // Simple nginx syntax highlighting
    const highlightNginx = (code) => {
        if (!code) return '';

        return code
            // Comments
            .replace(/(#.*$)/gm, '<span class="comment">$1</span>')
            // Strings
            .replace(/("[^"]*")/g, '<span class="string">$1</span>')
            .replace(/('[^']*')/g, '<span class="string">$1</span>')
            // Variables
            .replace(/(\$\w+)/g, '<span class="variable">$1</span>')
            // Numbers
            .replace(/\b(\d+[smhd]?)\b/g, '<span class="number">$1</span>')
            // Keywords
            .replace(/\b(server|location|upstream|http|events|if|return|rewrite|set)\b/g, '<span class="keyword">$1</span>')
            // Directives
            .replace(/\b(listen|server_name|root|index|proxy_pass|ssl_certificate|ssl_certificate_key|error_log|access_log|worker_processes|worker_connections|include|default_type|sendfile|keepalive_timeout|gzip|try_files|alias|add_header)\b/g, '<span class="directive">$1</span>');
    };

    return (
        <div className="config-viewer">
            <div className="header">
                <span className="filename">📄 {filename}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>nginx</span>
            </div>
            <pre className="nginx-config" dangerouslySetInnerHTML={{ __html: highlightNginx(content) }} />
        </div>
    );
}
