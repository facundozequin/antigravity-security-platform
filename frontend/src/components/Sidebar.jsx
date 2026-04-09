import React from 'react'
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
    const menuItems = [
        { path: '/', label: 'Dashboard', icon: '📊' },
        { path: '/sites', label: 'NGINX', icon: '🌐' },
        { path: '/waf', label: 'WAF', icon: '🛡️' },
        { path: '/fail2ban', label: 'Fail2Ban', icon: '🚫' },
        { path: '/logs', label: 'Logs', icon: '📝' },
        { path: '/threat-intel', label: 'Threat Intel', icon: '🔍' },
        { path: '/ai', label: 'IA Analysis', icon: '🤖' },
        { path: '/remediation', label: 'Remediation', icon: '⚡' },
        { path: '/intelligence', label: 'Intelligence', icon: '🧠' },
        { path: '/alerts', label: 'Alerts', icon: '🔔' },
        { path: '/reports', label: 'Reports', icon: '📄' },
        { path: '/settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <span className="logo-icon">🛡️</span>
                    <span className="logo-text">Security Platform</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        end={item.path === '/'}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="status-indicator">
                    <span className="status-dot online"></span>
                    <span>Agent Connected</span>
                </div>
            </div>

            <style>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: var(--sidebar-width);
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          z-index: 100;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          font-size: 1.5rem;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--border-radius-sm);
          color: var(--text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .nav-item:hover {
          background: var(--bg-card);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--accent-gradient);
          color: white;
        }

        .nav-icon {
          font-size: 1.1rem;
        }

        .nav-label {
          font-weight: 500;
        }

        .sidebar-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--border-color);
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
        }

        .status-dot.online {
          background: var(--success);
          box-shadow: 0 0 8px var(--success);
        }

        @media (max-width: 768px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
        </aside>
    );
}
