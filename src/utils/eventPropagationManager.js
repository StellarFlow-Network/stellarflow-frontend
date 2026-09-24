/**
 * Event Propagation Manager
 * Handles isolation of click events on status icons/cells
 * Prevents event bubbling to parent row handlers
 */

export const stopEventPropagation = (e) => {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
};

export const stopEventImmediately = (e) => {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
};

export const createIsolatedClickHandler = (callback) => {
  return (e) => {
    stopEventPropagation(e);
    if (typeof callback === 'function') {
      callback(e);
    }
  };
};

export const createCellClickHandler = (onCellClick, shouldPropagate = false) => {
  return (e) => {
    if (!shouldPropagate) {
      stopEventPropagation(e);
    }
    if (typeof onCellClick === 'function') {
      onCellClick(e);
    }
  };
};

export const withEventIsolation = (Component) => {
  return (props) => {
    const handleClick = (e) => {
      stopEventPropagation(e);
      if (props.onClick) {
        props.onClick(e);
      }
    };

    return <Component {...props} onClick={handleClick} />;
  };
};
