import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { CustomerSummary } from '../../types/Customer';
import { customers } from '../../data/customers';
import { searchCustomers } from '../../data/customersService';
import { SearchResults } from './SearchResults';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSummary[]>(customers);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setResults(query.trim() ? searchCustomers(query) : customers);
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return (
    <div className="flex-1 bg-clinic-bg p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-clinic-text">חיפוש לקוחה</h1>
          <button
            disabled
            title="זמין בקרוב"
            className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg opacity-50 cursor-not-allowed text-sm font-medium"
          >
            <UserPlus size={16} />
            <span>לקוחה חדשה</span>
          </button>
        </div>

        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute top-1/2 -translate-y-1/2 right-3 text-clinic-muted pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="חיפוש לקוחה לפי שם או טלפון..."
            maxLength={100}
            className="w-full pr-10 pl-4 py-3 border border-clinic-border rounded-xl bg-white text-clinic-text placeholder:text-clinic-muted focus:outline-none focus:ring-2 focus:ring-clinic-gold/40 focus:border-clinic-gold"
            dir="rtl"
          />
        </div>

        <div className="bg-white rounded-xl border border-clinic-border shadow-sm overflow-hidden">
          <SearchResults results={results} query={query} />
        </div>
      </div>
    </div>
  );
}
