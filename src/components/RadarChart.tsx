import React from 'react';
import { StudentEvalDimensions } from '../types';

interface RadarChartProps {
  data: StudentEvalDimensions;
  compareData?: StudentEvalDimensions;
  size?: number;
  labelMain?: string;
  labelCompare?: string;
  showLegend?: boolean;
}

const DIMENSION_KEYS: { key: keyof StudentEvalDimensions; label: string }[] = [
  { key: 'bias_fairness', label: '偏见与公平' },
  { key: 'toxicity', label: '无毒合规' },
  { key: 'compliance_refusal', label: '拒绝质量' },
  { key: 'helpfulness', label: '助人有效' },
  { key: 'truthfulness', label: '真实客观' },
  { key: 'robustness', label: '防御鲁棒' },
];

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  compareData,
  size = 280,
  labelMain = '当前档位',
  labelCompare = '对比基线',
  showLegend = true,
}) => {
  const center = size / 2;
  const radius = (size / 2) - 42;
  const count = DIMENSION_KEYS.length;
  const angleStep = (Math.PI * 2) / count;

  // Grid levels (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (value: number, index: number, max = 100) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (Math.max(0, Math.min(max, value)) / max) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getLabelCoordinates = (index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = radius + 22;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const mainPolygonPoints = DIMENSION_KEYS.map((dim, i) => {
    const coord = getCoordinates(data[dim.key] ?? 50, i);
    return `${coord.x},${coord.y}`;
  }).join(' ');

  const comparePolygonPoints = compareData
    ? DIMENSION_KEYS.map((dim, i) => {
        const coord = getCoordinates(compareData[dim.key] ?? 50, i);
        return `${coord.x},${coord.y}`;
      }).join(' ')
    : null;

  return (
    <div className="flex flex-col items-center justify-center select-none" id="radar-chart-container">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background circular web */}
        {gridLevels.map((lvl) => (
          <polygon
            key={lvl}
            points={DIMENSION_KEYS.map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = radius * lvl;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(' ')}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray={lvl === 1.0 ? 'none' : '2,2'}
          />
        ))}

        {/* Web Axes */}
        {DIMENSION_KEYS.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const endX = center + radius * Math.cos(angle);
          const endY = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={endX}
              y2={endY}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {/* Compare Polygon if provided */}
        {comparePolygonPoints && (
          <polygon
            points={comparePolygonPoints}
            fill="rgba(148, 163, 184, 0.25)"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />
        )}

        {/* Main Polygon */}
        <polygon
          points={mainPolygonPoints}
          fill="rgba(59, 130, 246, 0.22)"
          stroke="#2563eb"
          strokeWidth="2"
        />

        {/* Main data dots */}
        {DIMENSION_KEYS.map((dim, i) => {
          const coord = getCoordinates(data[dim.key] ?? 50, i);
          return (
            <circle
              key={dim.key}
              cx={coord.x}
              cy={coord.y}
              r="3.5"
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Dimension Labels */}
        {DIMENSION_KEYS.map((dim, i) => {
          const coord = getLabelCoordinates(i);
          const val = data[dim.key] ?? 0;
          return (
            <g key={dim.key} transform={`translate(${coord.x}, ${coord.y})`}>
              <text
                x="0"
                y="-4"
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="500"
                fill="#475569"
              >
                {dim.label}
              </text>
              <text
                x="0"
                y="8"
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="600"
                fill="#2563eb"
              >
                {val}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-600/30 border border-blue-600 inline-block" />
            <span>{labelMain}</span>
          </div>
          {compareData && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-400/30 border border-slate-400 border-dashed inline-block" />
              <span>{labelCompare}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
