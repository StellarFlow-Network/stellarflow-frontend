import React from "react";
import Nav from "./components/nav";
import FloatingSidebar from "./components/FloatingSidebar";
import SystemStats from "./components/SystemStats";

const page = () => {
  return (
    <div className="min-h-screen bg-[#020817] text-white selection:bg-[#CBF34D]/30">
      <Nav />
      {/* Sidebar - Positioned for the dashboard layout */}
      <FloatingSidebar />
      
      <main className="pl-24 pr-8 py-10 md:py-16">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* System At-A-Glance Stats Section */}
          <SystemStats />
          
          {/* Placeholder for subsequent sections (NGN/XLM 24h, Data Traffic, etc.) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8 opacity-40">
            <div className="h-64 bg-[#0B121C] border border-[#334155]/30 rounded-xl animate-pulse" />
            <div className="h-64 bg-[#0B121C] border border-[#334155]/30 rounded-xl animate-pulse" />
          </section>
        </div>
      </main>
    </div>
  );
};

export default page;