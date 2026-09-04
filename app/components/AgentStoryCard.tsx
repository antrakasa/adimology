'use client';

import { useState, useEffect, useRef } from 'react';
import type { AgentStoryResult, MatriksStoryItem, ChecklistKatalis } from '@/lib/types';
import { renderWithLinks } from '@/lib/utils';

interface AgentStoryCardProps {
  stories: AgentStoryResult[];
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'error';
  onRetry?: () => void;
}

export default function AgentStoryCard({ stories, status, onRetry }: AgentStoryCardProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const prevStatusRef = useRef(status);

  // Update selectedId when new stories arrive or when analysis completes
  useEffect(() => {
    if (stories.length > 0) {
      // 1. Initial selection if nothing selected
      if (!selectedId) {
        setSelectedId(stories[0].id || null);
      }
      
      // 2. Auto-switch to newest if analysis just finished
      if (prevStatusRef.current !== 'completed' && status === 'completed') {
        setSelectedId(stories[0].id || null);
      }
    }
    prevStatusRef.current = status;
  }, [stories, status, selectedId]);

  const data = stories.find(s => s.id === selectedId) || stories[0];
  // Loading state
  if (status === 'pending' || status === 'processing') {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          {status === 'pending' ? 'Memulai analisis...' : 'AI sedang menganalisis berita...'}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Proses ini membutuhkan waktu beberapa menit
        </p>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="glass-card" style={{ 
        padding: '2rem', 
        textAlign: 'center',
        borderColor: 'var(--accent-warning)'
      }}>
        <p style={{ color: 'var(--accent-warning)', marginBottom: '1rem' }}>
          ❌ {stories[0]?.error_message || 'Gagal menganalisis story'}
        </p>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            🔄 Coba Lagi
          </button>
        )}
      </div>
    );
  }

  // No data state
  if ((!stories || stories.length === 0) && status === 'idle') {
    return null;
  }

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem',
        marginBottom: '1.25rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: '1.25rem' }}>🤖</span>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1.1rem',
          fontWeight: 500,
          color: 'var(--text-primary)'
        }}>
          AI Story Analysis
        </h3>

        {data?.model && (
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '999px',
            padding: '2px 8px',
            whiteSpace: 'nowrap'
          }}>
            {data.model}{data.thinking_level ? ` · ${data.thinking_level}` : ''}
          </span>
        )}

        {/* Multi-version Dropdown */}
        {stories.length > 1 && (
          <select 
            value={selectedId || ''} 
            onChange={(e) => setSelectedId(Number(e.target.value))}
            style={{
              marginLeft: 'auto',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {stories.map((s) => (
              <option key={s.id} value={s.id} style={{ background: '#1a1a1a' }}>
                {s.created_at ? new Date(s.created_at).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Unknown Date'}
              </option>
            ))}
          </select>
        )}

        {stories.length <= 1 && data?.created_at && (
          <span style={{ 
            fontSize: '0.7rem', 
            color: 'var(--text-muted)',
            marginLeft: 'auto'
          }}>
            {new Date(data.created_at).toLocaleDateString('id-ID')}
          </span>
        )}
      </div>

      {/* Section 1: Matriks Story */}
      {data.matriks_story && data.matriks_story.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            fontWeight: 500,
            opacity: 0.9
          }}>
            1. Matriks Story & Logika Pergerakan Harga
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              fontSize: '0.875rem',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 400 }}>Kategori</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 400 }}>Katalis</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 400 }}>Logika Pasar</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 400 }}>Dampak Harga</th>
                </tr>
              </thead>
              <tbody>
                {data.matriks_story.map((item: MatriksStoryItem, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--glass-inner-glow)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {item.kategori_story}
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>
                      {renderWithLinks(item.deskripsi_katalis)}
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                      {renderWithLinks(item.logika_ekonomi_pasar)}
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--story-impact)' }}>
                      {renderWithLinks(item.potensi_dampak_harga)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2: SWOT Analysis */}
      {data.swot_analysis && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            fontWeight: 500,
            opacity: 0.9
          }}>
            2. Analisis SWOT
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '0.75rem',
            fontSize: '0.875rem'
          }}>
            <div style={{ 
              background: 'var(--bg-card)', 
              padding: '0.75rem', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ color: 'var(--accent-success)', fontWeight: 500 }}>Strengths</span>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                {data.swot_analysis.strengths?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div style={{ 
              background: 'var(--bg-card)', 
              padding: '0.75rem', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ color: 'var(--accent-warning)', fontWeight: 500 }}>Weaknesses</span>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                {data.swot_analysis.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
            <div style={{ 
              background: 'var(--bg-card)', 
              padding: '0.75rem', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Opportunities</span>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                {data.swot_analysis.opportunities?.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            <div style={{ 
              background: 'var(--bg-card)', 
              padding: '0.75rem', 
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ color: '#ffc107', fontWeight: 500 }}>Threats</span>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                {data.swot_analysis.threats?.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Checklist Katalis */}
      {data.checklist_katalis && data.checklist_katalis.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            fontWeight: 500,
            opacity: 0.9
          }}>
            3. Checklist Katalis Jangka Pendek
          </h4>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.875rem' 
          }}>
            {data.checklist_katalis.map((item: ChecklistKatalis, idx: number) => (
              <div key={idx} style={{ 
                display: 'flex', 
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                alignItems: 'flex-start'
              }}>
                <div style={{ 
                  background: 'rgba(255,255,255,0.1)',
                  minWidth: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  flexShrink: 0
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {renderWithLinks(item.item)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    <span style={{ color: 'var(--accent-primary)', marginRight: '4px' }}>→</span>
                    {renderWithLinks(item.dampak_instan)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Strategi Trading */}
      {data.strategi_trading && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            fontWeight: 500,
            opacity: 0.9
          }}>
            4. Strategi Trading
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '0.75rem',
            fontSize: '0.875rem'
          }}>
            {/* Tipe Saham */}
            <div style={{ 
              padding: '0.75rem', 
              background: 'var(--bg-card)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipe Saham</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{data.strategi_trading.tipe_saham}</span>
            </div>

            {/* Target Entry */}
            <div style={{ 
              padding: '0.75rem', 
              background: 'var(--bg-card)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Entry</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{data.strategi_trading.target_entry}</span>
            </div>

            {/* Take Profit */}
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(0, 200, 150, 0.05)', 
              borderRadius: '8px', 
              border: '1px solid rgba(0, 200, 150, 0.15)',
              borderLeft: '4px solid var(--accent-success)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ color: 'var(--accent-success)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Take Profit</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {data.strategi_trading.exit_strategy?.take_profit}
              </span>
            </div>

            {/* Stop Loss */}
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(245, 87, 108, 0.05)', 
              borderRadius: '8px', 
              border: '1px solid rgba(245, 87, 108, 0.15)',
              borderLeft: '4px solid var(--accent-warning)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ color: 'var(--accent-warning)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stop Loss</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {data.strategi_trading.exit_strategy?.stop_loss}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: KeyStat Signal */}
      {data.keystat_signal && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            fontWeight: 500,
            opacity: 0.9
          }}>
            5. Fundamental Signal (Key Statistics)
          </h4>
          <div style={{ 
            padding: '1rem',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)'
          }}>
            {renderWithLinks(data.keystat_signal)}
          </div>
        </div>
      )}

      {/* Kesimpulan */}
      {data.kesimpulan && (
        <div style={{ 
          padding: '1rem',
          background: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '0.9rem',
          lineHeight: 1.6
        }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Kesimpulan:</span>
          <div style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
            {renderWithLinks(data.kesimpulan)}
          </div>
        </div>
      )}

      {/* Sumber Referensi */}
      {data.sources && data.sources.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            fontWeight: 500,
            opacity: 0.9
          }}>
            📚 Sumber Referensi
          </h4>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.85rem'
          }}>
            {data.sources.map((source, idx) => (
              <a 
                key={idx}
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ 
                  fontSize: '0.7rem', 
                  background: 'rgba(102, 126, 234, 0.2)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: 'var(--accent-primary)',
                  fontWeight: 600
                }}>
                  {idx + 1}
                </span>
                <span style={{ 
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {source.title}
                </span>
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ opacity: 0.6, flexShrink: 0 }}
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>

  );
}
