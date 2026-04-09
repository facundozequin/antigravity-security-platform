import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Dot
} from 'recharts';

    const intelColors = {
      'synced': '#10b981',
      'cooldown': '#f59e0b',
      'local': '#64748b'
    };

    return (
      <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md min-w-[180px]">
        <div className="flex justify-between items-center mb-2">
          <p className="text-slate-400 text-[10px] font-mono">{data.timestamp}</p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: intelColors[data.intel_status] || '#64748b' }}></span>
            <span className="text-[10px] uppercase font-bold" style={{ color: intelColors[data.intel_status] || '#64748b' }}>{data.intel_status}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-300 text-sm">Target Risk:</span>
            <span className={`font-bold text-sm ${data.risk > 70 ? 'text-red-400' : (data.risk > 30 ? 'text-amber-400' : 'text-emerald-400')}`}>
              {data.risk.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-300 text-sm">Volume:</span>
            <span className="text-blue-400 font-bold text-sm">{data.volume} <span className="text-[10px] font-normal text-slate-500">req/m</span></span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Pattern</span>
              <span className="text-[10px] font-bold" style={{ color: patternColors[data.pattern] }}>{data.pattern}</span>
            </div>
            {data.last_intel_update && (
              <p className="text-[9px] text-slate-600 mt-1 italic text-right">Updated: {data.last_intel_update.split(' ')[1]}</p>
            )}
          </div>
        </div>
      </div>
    );

const RiskVolumeFusionChart = ({ data, baseline }) => {
  if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-500 italic">No historical data available</div>;

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.8}/>
            </linearGradient>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          
          <XAxis 
            dataKey="timestamp" 
            hide={true}
          />
          
          <YAxis 
            yAxisId="left"
            domain={[0, 100]}
            stroke="#475569"
            fontSize={10}
            tickFormatter={(value) => `${value}`}
            label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10, offset: 10 }}
          />
          
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#475569"
            fontSize={10}
            label={{ value: 'Req/min', angle: 90, position: 'insideRight', fill: '#475569', fontSize: 10, offset: 10 }}
          />

          <Tooltip content={<CustomTooltip />} />
          
          {/* Baseline Indicator */}
          {baseline > 0 && (
            <ReferenceLine 
              yAxisId="right" 
              y={baseline} 
              stroke="#334155" 
              strokeDasharray="5 5"
              label={{ position: 'right', value: 'Baseline', fill: '#475569', fontSize: 9 }} 
            />
          )}

          {/* Volume Area (Context) */}
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="volume"
            fill="url(#volumeGradient)"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeOpacity={0.3}
            dot={false}
            activeDot={false}
          />

          {/* Risk Line (Primary) */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="risk"
            stroke="url(#riskGradient)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: '#ef4444', stroke: '#1e293b', strokeWidth: 2 }}
          />

          {/* Anomaly Dots */}
          {data.map((entry, index) => {
            if (entry.pattern === 'STEALTH') {
              return (
                <ReferenceDot
                  key={`stealth-${index}`}
                  yAxisId="left"
                  x={entry.timestamp}
                  y={entry.risk}
                  r={4}
                  fill="#a855f7"
                  stroke="#1e293b"
                  strokeWidth={2}
                />
              );
            }
            if (entry.pattern === 'AGGRESSIVE') {
              return (
                <ReferenceDot
                  key={`agg-${index}`}
                  yAxisId="left"
                  x={entry.timestamp}
                  y={entry.risk}
                  r={5}
                  fill="#ef4444"
                  stroke="#1e293b"
                  strokeWidth={2}
                />
              );
            }
            return null;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RiskVolumeFusionChart;
