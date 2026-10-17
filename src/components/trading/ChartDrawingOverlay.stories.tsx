import type { Meta, StoryObj } from '@storybook/react';
import { ChartDrawingOverlay, type DrawingShape } from './ChartDrawingOverlay';
import { useRef } from 'react';

const meta: Meta<typeof ChartDrawingOverlay> = {
  title: 'Trading/ChartDrawingOverlay',
  component: ChartDrawingOverlay,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ChartDrawingOverlay>;

export const Default: Story = {
  args: {
    width: 800,
    height: 420,
    disabled: false,
  },
  render: (args) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-8">
        <div className="relative" style={{ width: args.width, height: args.height }}>
          {/* Simulated chart background */}
          <div
            ref={chartContainerRef}
            className="absolute inset-0 bg-gray-900 rounded-lg border border-gray-800"
            style={{
              backgroundImage: `
                linear-gradient(rgba(31, 41, 55, 0.6) 1px, transparent 1px),
                linear-gradient(90deg, rgba(31, 41, 55, 0.6) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Chart Background (Simulated)</p>
            </div>
          </div>
          <ChartDrawingOverlay {...args} chartContainerRef={chartContainerRef} />
        </div>
      </div>
    );
  },
};

export const WithInitialDrawings: Story = {
  args: {
    width: 800,
    height: 420,
    disabled: false,
    initialDrawings: [
      {
        id: 'trendline-1',
        type: 'trendline',
        points: [
          { x: 100, y: 100 },
          { x: 400, y: 300 },
        ],
        color: '#10B981',
        lineWidth: 2,
        visible: true,
        createdAt: Date.now(),
      },
      {
        id: 'horizontal-1',
        type: 'horizontal',
        points: [
          { x: 0, y: 200 },
          { x: 800, y: 200 },
        ],
        color: '#EF4444',
        lineWidth: 2,
        visible: true,
        createdAt: Date.now(),
      },
      {
        id: 'rectangle-1',
        type: 'rectangle',
        points: [
          { x: 500, y: 150 },
          { x: 700, y: 350 },
        ],
        color: '#3B82F6',
        lineWidth: 2,
        visible: true,
        createdAt: Date.now(),
      },
    ] as DrawingShape[],
  },
  render: (args) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-8">
        <div className="relative" style={{ width: args.width, height: args.height }}>
          <div
            ref={chartContainerRef}
            className="absolute inset-0 bg-gray-900 rounded-lg border border-gray-800"
            style={{
              backgroundImage: `
                linear-gradient(rgba(31, 41, 55, 0.6) 1px, transparent 1px),
                linear-gradient(90deg, rgba(31, 41, 55, 0.6) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Chart Background (Simulated)</p>
            </div>
          </div>
          <ChartDrawingOverlay {...args} chartContainerRef={chartContainerRef} />
        </div>
      </div>
    );
  },
};

export const LargeSize: Story = {
  args: {
    width: 1200,
    height: 600,
    disabled: false,
  },
  render: (args) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-8">
        <div className="relative" style={{ width: args.width, height: args.height }}>
          <div
            ref={chartContainerRef}
            className="absolute inset-0 bg-gray-900 rounded-lg border border-gray-800"
            style={{
              backgroundImage: `
                linear-gradient(rgba(31, 41, 55, 0.6) 1px, transparent 1px),
                linear-gradient(90deg, rgba(31, 41, 55, 0.6) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Chart Background (Simulated)</p>
            </div>
          </div>
          <ChartDrawingOverlay {...args} chartContainerRef={chartContainerRef} />
        </div>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    width: 800,
    height: 420,
    disabled: true,
  },
  render: (args) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-8">
        <div className="relative" style={{ width: args.width, height: args.height }}>
          <div
            ref={chartContainerRef}
            className="absolute inset-0 bg-gray-900 rounded-lg border border-gray-800"
            style={{
              backgroundImage: `
                linear-gradient(rgba(31, 41, 55, 0.6) 1px, transparent 1px),
                linear-gradient(90deg, rgba(31, 41, 55, 0.6) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Chart Background (Simulated - Drawing Disabled)</p>
            </div>
          </div>
          <ChartDrawingOverlay {...args} chartContainerRef={chartContainerRef} />
        </div>
      </div>
    );
  },
};
