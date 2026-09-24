import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ToolAvailability from 'ui/common/ToolAvailability';
import ApproverTools from 'ui/toolCheckouts/ApproverTools';

describe('Availability representations', () => {
  it('preserves legacy tool names and annotates their outage status', () => {
    const html = renderToStaticMarkup(<ApproverTools approver={{ toolNames: ['Lathe', 'Saw'], outOfServiceToolNames: ['Lathe'] }} />);
    expect(html).toContain('Lathe - Out of service');
    expect(html).toContain('Saw');
  });
  it('prefers expanded tools and tolerates absent outage names', () => {
    expect(renderToStaticMarkup(<ApproverTools approver={{ toolNames: ['Legacy'], tools: [{ id: '1', name: 'Current', shopId: 'shop', outOfService: true }] }} />)).not.toContain('Legacy');
    expect(renderToStaticMarkup(<ApproverTools approver={{ toolNames: ['Legacy'] }} />)).toContain('Legacy');
  });
  it('renders an outage chip as a span inside phrasing containers', () => {
    const html = renderToStaticMarkup(<p><strong><ToolAvailability outOfService /></strong></p>);
    expect(html).toContain('Out of service');
    expect(html).toMatch(/<span[^>]*MuiChip-root/);
    expect(html).not.toContain('<div');
    expect(renderToStaticMarkup(<ToolAvailability outOfService={false} />)).toBe('');
  });
});
