import { 
  stopEventPropagation, 
  stopEventImmediately, 
  createIsolatedClickHandler,
  createCellClickHandler 
} from '../eventPropagationManager';

describe('Event Propagation Manager', () => {
  let mockEvent;

  beforeEach(() => {
    mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      target: document.createElement('div')
    };
  });

  test('should call stopPropagation on event', () => {
    stopEventPropagation(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  test('should call stopPropagation and preventDefault', () => {
    stopEventImmediately(mockEvent);
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  test('should create isolated click handler', () => {
    const callback = jest.fn();
    const handler = createIsolatedClickHandler(callback);
    handler(mockEvent);
    
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(mockEvent);
  });

  test('should create cell click handler with propagation control', () => {
    const callback = jest.fn();
    const handler = createCellClickHandler(callback, false);
    handler(mockEvent);
    
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  test('should allow propagation when specified', () => {
    const callback = jest.fn();
    const handler = createCellClickHandler(callback, true);
    handler(mockEvent);
    
    expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalled();
  });

  test('should handle null/undefined events gracefully', () => {
    expect(() => {
      stopEventPropagation(null);
      stopEventPropagation(undefined);
    }).not.toThrow();
  });
});
