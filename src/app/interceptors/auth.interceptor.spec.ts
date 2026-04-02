import { HttpInterceptorFn } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let interceptor: HttpInterceptorFn;
  
  const mockRequest = {
    url: 'https://api.example.com/data',
    clone: jest.fn(),
  };

  const mockNext = jest.fn();

  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
      },
      writable: true,
    });

    // Mock console to clean test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    interceptor = authInterceptor;
    mockNext.mockReturnValue('response');
    mockRequest.clone.mockImplementation((updates: any) => ({
      ...mockRequest,
      ...updates
    }));
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should add Authorization header when token exists', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('mock-token');

    interceptor(mockRequest as any, mockNext);

    expect(localStorage.getItem).toHaveBeenCalledWith('access_token');
    expect(mockRequest.clone).toHaveBeenCalledWith({
      setHeaders: { Authorization: 'Bearer mock-token' }
    });
  });

  it('should not modify request when token is missing', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(null);

    interceptor(mockRequest as any, mockNext);

    expect(localStorage.getItem).toHaveBeenCalledWith('access_token');
    expect(mockRequest.clone).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(mockRequest);
  });

  it('should not modify request when token is empty string', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('');

    interceptor(mockRequest as any, mockNext);

    expect(mockRequest.clone).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(mockRequest);
  });
});