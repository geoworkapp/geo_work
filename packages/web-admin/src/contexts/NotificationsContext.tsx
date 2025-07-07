import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import { useAuth } from './AuthContext';

export interface GeofenceAlertDoc {
  id: string;
  employeeId: string;
  companyId: string;
  jobSiteId: string;
  distance: number;
  firstDetected: any; // Firestore Timestamp
  lastSeen: any;
  active: boolean;
  resolvedAt?: any;
}

interface NotificationsContextValue {
  alerts: GeofenceAlertDoc[];
  unread: number;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationsProvider');
  return ctx;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState<GeofenceAlertDoc[]>([]);
  const [unread, setUnread] = useState(0);
  const [snack, setSnack] = useState<{ msg: string; severity: AlertColor } | null>(null);

  // Firestore listener for active alerts for this company
  useEffect(() => {
    if (!currentUser?.companyId) return;

    const q = query(
      collection(db, 'geofenceAlerts'),
      where('companyId', '==', currentUser.companyId),
      orderBy('lastSeen', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs: GeofenceAlertDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setAlerts(docs);
      // Count active unresolved alerts as unread (simple logic)
      setUnread(docs.filter((a) => a.active).length);
    });
    return () => unsub();
  }, [currentUser?.companyId]);

  // Foreground FCM listener dispatched from messaging.ts
  useEffect(() => {
    function handler(e: Event) {
      const payload = (e as CustomEvent).detail as any;
      if (payload?.notification?.title) {
        setSnack({ msg: payload.notification.title + ' - ' + payload.notification.body, severity: 'warning' });
      }
    }
    window.addEventListener('fcm-message', handler);
    return () => window.removeEventListener('fcm-message', handler);
  }, []);

  const markAllRead = () => setUnread(0);

  return (
    <NotificationsContext.Provider value={{ alerts, unread, markAllRead }}>
      {children}
      <Snackbar
        open={!!snack}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snack && (
          <Alert onClose={() => setSnack(null)} severity={snack.severity} sx={{ width: '100%' }}>
            {snack.msg}
          </Alert>
        )}
      </Snackbar>
    </NotificationsContext.Provider>
  );
}; 