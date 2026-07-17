import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, RefreshCw } from 'lucide-react';
import { CustomerSummary } from '../../types/Customer';
import { useCustomers } from '../../contexts/CustomersContext';
import { SearchResults } from './SearchResults';
import { NewCustomerModal } from '../customer/NewCustomerModal';

function searchCustomers(customers: CustomerSummary[], query: string): CustomerSummary[] {
  if (!query.trim()) return customers;
  if (query.length > 100) return [];
  const q = query.toLowerCase();
  return customers.filter(c =>
    c.fullName.toLowerCase().includes(q) ||
    c.phone.includes(q)
  );
}

export function SearchScreen() {
  const { customers, isLoading, error, refetch } = useCustomers();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSummary[]>(customers);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setResults(searchCustomers(customers, query));
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, customers]);

  return (
    <div className="flex-1 bg-clinic-bg p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-clinic-text">חיפוש לקוחה</h1>
          <button
            onClick={() => setNewCustomerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm font-medium hover:bg-clinic-blush transition-colors"
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

        {error ? (
          <div className="bg-white rounded-xl border border-clinic-border shadow-sm p-8 text-center">
            <p className="text-red-500 text-sm mb-4">שגיאה בטעינת הנתונים. נסה שוב.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 mx-auto text-sm text-clinic-gold hover:opacity-80"
            >
              <RefreshCw size={14} />
              <span>נסה שוב</span>
            </button>
          </div>
        ) : isLoading ? (
          <div className="bg-white rounded-xl border border-clinic-border shadow-sm overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-clinic-border">
                <div className="w-9 h-9 rounded-full bg-clinic-blush animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-clinic-blush rounded animate-pulse w-32" />
                  <div className="h-2.5 bg-clinic-blush rounded animate-pulse w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-clinic-border shadow-sm overflow-hidden">
            <SearchResults results={results} query={query} />
          </div>
        )}
      </div>

      <NewCustomerModal open={newCustomerOpen} onClose={() => setNewCustomerOpen(false)} />
    </div>
  );
}
