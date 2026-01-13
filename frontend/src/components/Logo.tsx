interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Logo = ({ className = '', size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer circle with gradient */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="url(#logoGradient)" opacity="0.1" />
      
      {/* Main circle */}
      <circle cx="50" cy="50" r="42" stroke="url(#logoGradient)" strokeWidth="3" fill="none" />
      
      {/* Cursor arrow shape - simplified pointer */}
      <path
        d="M 35 35 L 50 50 L 40 50 L 50 65 L 50 50 L 65 35 Z"
        fill="url(#logoGradient)"
        stroke="none"
      />
      
      {/* Number "2" - positioned better */}
      <text
        x="50"
        y="72"
        fontSize="22"
        fontWeight="bold"
        fill="url(#logoGradient)"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        2.0
      </text>
    </svg>
  );
};

export default Logo;
