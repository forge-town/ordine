import { siGithub } from "simple-icons";
import React from "react";

export const SiGitHubIcon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  (props, ref) => (
    <svg
      ref={ref}
      aria-label={siGithub.title}
      fill="currentColor"
      role="img"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d={siGithub.path} />
    </svg>
  )
);

SiGitHubIcon.displayName = "SiGitHubIcon";
