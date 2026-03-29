import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, TrendingUp } from 'lucide-react';

/**
 * Renders right sidebar cards including elections and topics.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function HomeSidebar({ activeElections }) {
  return (
    <div className="lg:col-span-4 space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Active Elections
          </h3>
          <Link to="/home" className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</Link>
        </div>

        <div className="space-y-4">
          {activeElections.map((election) => (
            <Link key={election.id} to="/home" className="block group">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">{election.status}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {election.date}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{election.title}</h4>
                <p className="text-sm text-slate-500 mb-3">{election.region}</p>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] text-slate-500 font-bold overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <span className="ml-1 text-blue-600 group-hover:underline">{election.candidatesCount} Candidates</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Trending Topics</h3>
        <div className="flex flex-wrap gap-2">
          {['#Election2026', '#ClimateAction', '#TechPrivacy', '#CityCouncil', '#Education', '#PublicTransit', '#LocalBusiness'].map((tag) => (
            <Link
              key={tag}
              to="/home"
              className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-sm font-medium rounded-lg transition-colors border border-slate-100 hover:border-blue-100"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-blue-600 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <h3 className="text-lg font-bold mb-2 relative z-10">Stay Informed</h3>
        <p className="text-blue-100 text-sm mb-4 relative z-10">Get the latest updates on elections and local news delivered to your inbox.</p>
        <form className="relative z-10 space-y-2" onSubmit={(event) => event.preventDefault()}>
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
          />
          <button className="w-full py-2 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors text-sm">Subscribe</button>
        </form>
      </div>
    </div>
  );
}
