import React from 'react';

const Breadcrumb = () => {
  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <div className="flex items-center">
            <a href="#" className="text-zinc-500 hover:text-zinc-300 text-xs font-medium uppercase tracking-wider transition-colors">
              Admin
            </a>
          </div>
        </li>
        <li>
          <div className="flex items-center">
            <span className="text-zinc-700 text-xs mx-1">/</span>
            <a href="#" className="text-[#CBF34D] text-xs font-semibold uppercase tracking-wider">
              Live Oracle
            </a>
          </div>
        </li>
      </ol>
    </nav>
  );
};

export default Breadcrumb;
