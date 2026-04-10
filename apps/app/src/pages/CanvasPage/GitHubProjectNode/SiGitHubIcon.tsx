import { siGithub } from "simple-icons";

export const SiGitHubIcon = ({ className }: { className?: string }) => (
  <svg
    aria-label={siGithub.title}
    className={className}
    fill="currentColor"
    role="img"
    viewBox="0 0 24 24"
  >
    <path d={siGithub.path} />
  </svg>
);
