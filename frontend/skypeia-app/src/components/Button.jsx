import React from 'react';

// Simple presentational Button component added because the CLI add command
// did not complete interactively in this environment. You can replace this
// with the official Unstyled UI/Untitled design after running the CLI locally.

export default function Button({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={"px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none " + className}
      {...props}
    >
      {children}
    </button>
  );
}
