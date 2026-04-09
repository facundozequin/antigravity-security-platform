import React, { useState, useEffect } from 'react';
import RiskVolumeFusionChart from '../components/Intelligence/RiskVolumeFusionChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip } from 'recharts';

const Intelligence = () => {
  const [profiles, setProfiles] = useState([]);
  const [selectedIp, setSelectedIp] = useState(null);
  const [insightData, setInsightData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [timeframe, setTimeframe] = useState('24h');
  const [intelStatus, setIntelStatus] = useState({ abuseipdb: 'active', geoip: 'active' });

  useEffect(() => {
    fetchProfiles();
    fetchIntelStatus();
  }, []);

  useEffect(() => {
    if (selectedIp) {
      fetchInsight(selectedIp);
      fetchHistory(selectedIp);
    }
  }, [selectedIp, timeframe]);

  const fetchIntelStatus = async () => {
    try {
      const response = await fetch('/api/profiles/stats/intel');
      const data = await response.json();
      setIntelStatus(data);
    } catch (error) {
      console.error('Error fetching intel status:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles/');
      const data = await response.json();
      setProfiles(data);
      if (data.length > 0 && !selectedIp) {
        setSelectedIp(data[0].client_ip);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      setLoading(false);
    }
  };

  const fetchInsight = async (ip) => {
    try {
      const response = await fetch(`/api/profiles/${ip}/insight?timeframe=${timeframe}`);
      const data = await response.json();
      setInsightData(data);
    } catch (error) {
      console.error('Error fetching insight:', error);
    }
  };

  const fetchHistory = async (ip) => {
    try {
      const response = await fetch(`/api/profiles/remediation/${ip}/history`);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleReset = async (ip) => {
    if (!window.confirm(`Reset all strikes for ${ip}?`)) return;
    try {
      await fetch(`/api/profiles/${ip}/reset`, { method: 'POST' });
      fetchProfiles();
      fetchInsight(ip);
    } catch (error) {
      console.error('Error resetting strikes:', error);
    }
  };

  const getStrikeData = (profile) => {
    if (!profile) return [];
    return [
      { name: 'WAF', value: profile.waf_strikes, color: '#f59e0b' },
      { name: 'Auth', value: profile.auth_strikes, color: '#ef4444' },
      { name: 'AI', value: profile.ai_strikes, color: '#8b5cf6' },
    ].filter(s => s.value > 0);
  };

  const getCountryFlag = (code) => {
    if (!code) return '🌐';
    const codePoints = code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  };

  if (loading) return <div className="p-8 text-slate-400">Initializing Intelligence Hub...</div>;

  const currentProfile = insightData?.profile;
  const strikeData = getStrikeData(currentProfile);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligence Hub</h1>
          <p className="text-slate-500 text-sm">Behavioral forensic analysis and adaptive reputation monitoring</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
             <div className="flex items-center gap-2 px-2 border-r border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-black">Intel Sync</span>
                <span className={`w-1.5 h-1.5 rounded-full ${intelStatus.abuseipdb === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} title={`AbuseIPDB: ${intelStatus.abuseipdb}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${intelStatus.geoip === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} title={`GeoIP: ${intelStatus.geoip}`}></span>
             </div>
            {['1h', '24h', '7d'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${timeframe === tf ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar: IP List */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Target Profiles</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {profiles.map((p) => (
                <div
                  key={p.client_ip}
                  onClick={() => setSelectedIp(p.client_ip)}
                  className={`p-4 cursor-pointer border-b border-slate-800/50 transition-all hover:bg-slate-800/30 ${selectedIp === p.client_ip ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{getCountryFlag(p.country_code)}</span>
                      <span className="font-mono text-sm font-bold">{p.client_ip}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${p.reputation_score > 70 ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                      {p.reputation_score}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] text-slate-500 truncate">{p.isp || 'Internal Network'}</p>
                    <div className="flex gap-2 text-[10px] text-slate-500">
                      <span>{p.waf_strikes + p.auth_strikes + p.ai_strikes} Strikes</span>
                      {p.is_repeat_offender && <span className="text-amber-500 font-bold uppercase tracking-tighter">Repeat</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Combined Risk</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${currentProfile?.reputation_score > 70 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                <p className="font-bold text-lg">{currentProfile?.reputation_score > 70 ? 'High Threat' : (currentProfile?.reputation_score > 30 ? 'Suspicious' : 'Operational')}</p>
              </div>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Behavioral Risk</p>
              <p className="font-bold text-2xl font-mono">{currentProfile?.avg_risk_score}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">External Abuse</p>
              <div className="flex items-baseline gap-1">
                <p className={`font-bold text-2xl ${currentProfile?.external_abuse_score > 50 ? 'text-red-400' : 'text-slate-200'}`}>{currentProfile?.external_abuse_score}%</p>
                <span className="text-[10px] text-slate-600">Confidence</span>
              </div>
            </div>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Global Reputation</p>
              <p className="font-bold text-2xl">{100 - (currentProfile?.reputation_score || 0)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Geo & ISP Insights */}
            <div className="col-span-12 lg:col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5">
               <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Origin Context</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-xl">
                        {getCountryFlag(currentProfile?.country_code)}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{currentProfile?.city || 'Unknown City'}</p>
                        <p className="text-[10px] text-slate-500">{currentProfile?.country_code || '---'} Location</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/30 rounded border border-slate-800/50">
                       <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Provider Attribution</p>
                       <p className="text-xs font-bold text-blue-400 truncate">{currentProfile?.isp || 'Internal/Private Network'}</p>
                       <p className="text-[10px] text-slate-500 mt-1">{currentProfile?.asn || 'ASN not visible'}</p>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 italic">Last Global Sync:</span>
                      <span className="text-slate-400 uppercase">{currentProfile?.last_intel_update ? new Date(currentProfile.last_intel_update).toLocaleString() : 'Never'}</span>
                    </div>
                  </div>
               </div>
               
               {currentProfile?.intel_status === 'cooldown' && (
                 <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded flex items-center gap-3">
                    <span className="text-amber-500 text-lg">⚠️</span>
                    <div>
                      <p className="text-[10px] font-bold text-amber-500 uppercase">Circuit Breaker Active</p>
                      <p className="text-[10px] text-amber-600/80">External intel temporarily suspended due to provider timeout.</p>
                    </div>
                 </div>
               )}
            </div>

            {/* Fusion Chart Section */}
            <div className="col-span-12 lg:col-span-8 bg-slate-900 rounded-xl border border-slate-800 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold">Threat Pattern Detection</h3>
                  <p className="text-xs text-slate-500">Correlation of Request Spikes vs Behavioral and External Risk</p>
                </div>
              </div>
              
              <RiskVolumeFusionChart 
                data={insightData?.analytics} 
                baseline={insightData?.analytics?.[0]?.baseline} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Strike Distribution */}
            <div className="md:col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 self-start mb-4">Strike Source Mapping</h3>
              <div className="h-44 w-full">
                {strikeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={strikeData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {strikeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <PieTooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">No active strikes detected</div>
                )}
              </div>
              <div className="flex gap-4 mt-4">
                {strikeData.map(s => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                    <span className="text-[10px] font-medium text-slate-400">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit & Control */}
            <div className="md:col-span-8 bg-slate-900 rounded-xl border border-slate-800 p-6">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Forensic Audit Log</h3>
                 <button 
                  onClick={() => handleReset(selectedIp)}
                  className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded hover:bg-red-500 hover:text-white transition-all font-bold uppercase tracking-tighter"
                 >
                   Clear Identity Shards
                 </button>
               </div>
               <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {history.length > 0 ? history.map((h, i) => (
                    <div key={i} className="bg-slate-800/30 p-3 rounded border border-slate-800/50 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-300">{h.reason}</p>
                        <p className="text-[10px] text-slate-500">{new Date(h.created_at).toLocaleString()} • Dur: {h.duration_mins}m</p>
                      </div>
                      <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono text-slate-500">
                        {h.source.toUpperCase()}
                      </span>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-600 text-xs italic border-2 border-dashed border-slate-800 rounded">No remediation events found in historical shards</div>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Intelligence;
