type StatusBannerProps = {
  message: string | null;
};

export function StatusBanner({ message }: StatusBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="status-banner" role="status">
      {message}
    </div>
  );
}
