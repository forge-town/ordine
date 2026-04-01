import { siGithub } from "simple-icons";

export const SiGitHubIcon = ({ className }: { className?: string }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-label={siGithub.title}
  >
    <path d={siGithub.path} />
  </svg>
);
