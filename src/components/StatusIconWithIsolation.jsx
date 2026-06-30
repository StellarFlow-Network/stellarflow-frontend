import React from 'react';
import { useIsolatedCellClick } from '../hooks/useIsolatedCellClick';
import { EVENT_CONFIG } from '../config/eventConfig';

export const StatusIconWithIsolation = ({ 
  status = 'online', 
  onClick, 
  className = '' 
}) => {
  const { createStatusIconHandler } = useIsolatedCellClick(onClick);

  const handleStatusClick = createStatusIconHandler((e) => {
    console.debug('Status icon clicked:', status);
    if (onClick) {
      onClick({ status, originalEvent: e });
    }
  });

  const getStatusColor = (status) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500',
      busy: 'bg-red-500'
    };
    return colors[status] || colors.offline;
  };

  return (
    <div
      data-isolated-click
      data-status={status}
      onClick={handleStatusClick}
      className={`inline-flex items-center justify-center w-3 h-3 rounded-full cursor-pointer transition-all ${getStatusColor(status)} ${className}`}
      role="img"
      aria-label={`Status: ${status}`}
      title={`User is ${status}`}
    />
  );
};

export const TableRowWithIsolatedCell = ({ 
  rowData, 
  onRowClick, 
  onStatusClick 
}) => {
  const { createRowHandler, createStatusIconHandler } = useIsolatedCellClick(onRowClick);

  return (
    <tr onClick={createRowHandler(onRowClick)}>
      <td>{rowData.name}</td>
      <td>
        <StatusIconWithIsolation 
          status={rowData.status}
          onClick={onStatusClick}
        />
      </td>
      <td>{rowData.email}</td>
    </tr>
  );
};
