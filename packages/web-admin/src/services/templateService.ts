import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc,
  setDoc,
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  Timestamp,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
  onSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ScheduleTemplate, Schedule } from '@shared/types';
import { format, addWeeks, addMonths, addDays } from 'date-fns';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TemplateFilters {
  searchQuery?: string;
  jobSiteId?: string;
  shiftType?: string[];
  categories?: string[];
  isActive?: boolean;
  createdBy?: string;
  duration?: { min: number; max: number };
  tags?: string[];
}

export interface TemplateSortOptions {
  field: 'templateName' | 'createdAt' | 'updatedAt' | 'usage_count' | 'rating';
  direction: 'asc' | 'desc';
}

export interface TemplateUsageStats {
  totalUsage: number;
  lastUsed: Date | null;
  averageRating: number;
  totalRatings: number;
  createdSchedulesCount: number;
  popularTimes: string[]; // Most common usage times
  popularJobSites: string[]; // Most used job sites
}

export interface TemplateAnalytics {
  templateId: string;
  usage: TemplateUsageStats;
  performance: {
    creationSpeed: number; // avg seconds to create schedule from template
    accuracy: number; // % of schedules created without modification
    userSatisfaction: number; // avg rating
  };
  trends: {
    weeklyUsage: number[];
    monthlyGrowth: number;
    peakUsageDays: string[];
  };
}

export interface CreateTemplateData {
  templateName: string;
  description?: string;
  jobSiteId?: string;
  shiftType: 'regular' | 'overtime' | 'emergency' | 'training';
  duration: number;
  breakDuration: number;
  defaultStartTime: string;
  defaultEndTime: string;
  recurrence: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[];
  };
  skillsRequired?: string[];
  equipmentNeeded?: string[];
  specialInstructions?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface TemplateApplicationOptions {
  targetDate: Date;
  endDate?: Date;
  employeeIds: string[];
  jobSiteId?: string; // Override template job site
  customizations?: {
    startTime?: string;
    endTime?: string;
    breakDuration?: number;
    specialInstructions?: string;
  };
  skipConflicts?: boolean;
  sendNotifications?: boolean;
}

// ============================================================================
// TEMPLATE SERVICE CLASS
// ============================================================================

export class TemplateService {
  private static instance: TemplateService;

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new schedule template
   */
  async createTemplate(
    companyId: string, 
    createdBy: string, 
    templateData: CreateTemplateData
  ): Promise<ScheduleTemplate> {
    try {
      const now = new Date();
      const templateDoc: Omit<ScheduleTemplate, 'templateId'> = {
        companyId,
        templateName: templateData.templateName,
        description: templateData.description,
        jobSiteId: templateData.jobSiteId,
        shiftType: templateData.shiftType,
        duration: templateData.duration,
        breakDuration: templateData.breakDuration,
        defaultStartTime: templateData.defaultStartTime,
        defaultEndTime: templateData.defaultEndTime,
        recurrence: templateData.recurrence,
        skillsRequired: templateData.skillsRequired || [],
        equipmentNeeded: templateData.equipmentNeeded || [],
        specialInstructions: templateData.specialInstructions,
        isActive: true,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(collection(db, 'scheduleTemplates'), {
        ...templateDoc,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        // Analytics initialization
        usage_count: 0,
        total_ratings: 0,
        average_rating: 0,
        last_used: null,
        tags: templateData.tags || [],
        is_public: templateData.isPublic || false,
      });

      const createdTemplate: ScheduleTemplate = {
        templateId: docRef.id,
        ...templateDoc,
      };

      // Initialize analytics document
      await this.initializeTemplateAnalytics(docRef.id);

      return createdTemplate;

    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<ScheduleTemplate | null> {
    try {
      const docSnap = await getDoc(doc(db, 'scheduleTemplates', templateId));
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        templateId: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ScheduleTemplate;

    } catch (error) {
      console.error('Error getting template:', error);
      throw new Error(`Failed to get template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get templates for company with filtering and pagination
   */
  async getTemplates(
    companyId: string,
    filters: TemplateFilters = {},
    sortOptions: TemplateSortOptions = { field: 'updatedAt', direction: 'desc' },
    pageSize: number = 20,
    lastDoc?: any
  ): Promise<{ templates: ScheduleTemplate[]; hasMore: boolean; lastDoc: any }> {
    try {
      let q = query(
        collection(db, 'scheduleTemplates'),
        where('companyId', '==', companyId)
      );

      // Apply filters
      if (filters.isActive !== undefined) {
        q = query(q, where('isActive', '==', filters.isActive));
      }

      if (filters.jobSiteId) {
        q = query(q, where('jobSiteId', '==', filters.jobSiteId));
      }

      if (filters.createdBy) {
        q = query(q, where('createdBy', '==', filters.createdBy));
      }

      if (filters.shiftType && filters.shiftType.length > 0) {
        q = query(q, where('shiftType', 'in', filters.shiftType));
      }

      // Add sorting
      q = query(q, orderBy(sortOptions.field, sortOptions.direction));

      // Add pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      q = query(q, limit(pageSize + 1)); // Get one extra to check if there are more

      const querySnapshot = await getDocs(q);
      const templates: ScheduleTemplate[] = [];
      const docs = querySnapshot.docs;

      // Process results
      for (let i = 0; i < Math.min(docs.length, pageSize); i++) {
        const doc = docs[i];
        const data = doc.data();
        
        let template: ScheduleTemplate = {
          templateId: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ScheduleTemplate;

        // Apply client-side filters
        if (this.matchesFilters(template, filters)) {
          templates.push(template);
        }
      }

      const hasMore = docs.length > pageSize;
      const newLastDoc = docs.length > 0 ? docs[Math.min(docs.length - 1, pageSize - 1)] : null;

      return { templates, hasMore, lastDoc: newLastDoc };

    } catch (error) {
      console.error('Error getting templates:', error);
      throw new Error(`Failed to get templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string, 
    updates: Partial<CreateTemplateData>,
    updatedBy: string
  ): Promise<ScheduleTemplate> {
    try {
      const templateRef = doc(db, 'scheduleTemplates', templateId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        lastModifiedBy: updatedBy,
      };

      await updateDoc(templateRef, updateData);

      // Get updated template
      const updatedTemplate = await this.getTemplate(templateId);
      if (!updatedTemplate) {
        throw new Error('Template not found after update');
      }

      return updatedTemplate;

    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error(`Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete template (soft delete - mark as inactive)
   */
  async deleteTemplate(templateId: string, deletedBy: string): Promise<void> {
    try {
      const templateRef = doc(db, 'scheduleTemplates', templateId);
      
      await updateDoc(templateRef, {
        isActive: false,
        deletedAt: serverTimestamp(),
        deletedBy,
        updatedAt: serverTimestamp(),
      });

    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Permanently delete template (use with caution)
   */
  async permanentlyDeleteTemplate(templateId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Delete template document
      batch.delete(doc(db, 'scheduleTemplates', templateId));
      
      // Delete analytics document
      batch.delete(doc(db, 'templateAnalytics', templateId));
      
      await batch.commit();

    } catch (error) {
      console.error('Error permanently deleting template:', error);
      throw new Error(`Failed to permanently delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // TEMPLATE APPLICATION
  // ============================================================================

  /**
   * Apply template to create schedules
   */
  async applyTemplate(
    templateId: string,
    options: TemplateApplicationOptions,
    createdBy: string
  ): Promise<{ 
    createdSchedules: Schedule[]; 
    conflicts: any[]; 
    errors: string[] 
  }> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const createdSchedules: Schedule[] = [];
      const conflicts: any[] = [];
      const errors: string[] = [];

      // Calculate schedule dates based on recurrence
      const scheduleDates = this.calculateScheduleDates(
        template,
        options.targetDate,
        options.endDate
      );

      // Create schedules for each date and employee
      for (const date of scheduleDates) {
        for (const employeeId of options.employeeIds) {
          try {
            const schedule = await this.createScheduleFromTemplate(
              template,
              date,
              employeeId,
              options,
              createdBy
            );
            
            createdSchedules.push(schedule);
            
          } catch (error) {
            errors.push(`Failed to create schedule for employee ${employeeId} on ${format(date, 'yyyy-MM-dd')}: ${error}`);
          }
        }
      }

      // Update template usage analytics
      await this.recordTemplateUsage(templateId, createdSchedules.length);

      return { createdSchedules, conflicts, errors };

    } catch (error) {
      console.error('Error applying template:', error);
      throw new Error(`Failed to apply template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // ANALYTICS & INSIGHTS
  // ============================================================================

  /**
   * Get template analytics
   */
  async getTemplateAnalytics(templateId: string): Promise<TemplateAnalytics | null> {
    try {
      const analyticsDoc = await getDoc(doc(db, 'templateAnalytics', templateId));
      
      if (!analyticsDoc.exists()) {
        return null;
      }

      const data = analyticsDoc.data();
      return {
        templateId,
        usage: {
          totalUsage: data.totalUsage || 0,
          lastUsed: data.lastUsed?.toDate() || null,
          averageRating: data.averageRating || 0,
          totalRatings: data.totalRatings || 0,
          createdSchedulesCount: data.createdSchedulesCount || 0,
          popularTimes: data.popularTimes || [],
          popularJobSites: data.popularJobSites || [],
        },
        performance: data.performance || {
          creationSpeed: 0,
          accuracy: 0,
          userSatisfaction: 0,
        },
        trends: data.trends || {
          weeklyUsage: [],
          monthlyGrowth: 0,
          peakUsageDays: [],
        },
      };

    } catch (error) {
      console.error('Error getting template analytics:', error);
      return null;
    }
  }

  /**
   * Get popular templates for company
   */
  async getPopularTemplates(
    companyId: string,
    limitCount: number = 10
  ): Promise<ScheduleTemplate[]> {
    try {
      const q = query(
        collection(db, 'scheduleTemplates'),
        where('companyId', '==', companyId),
        orderBy('usageCount', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        templateId: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as ScheduleTemplate[];
    } catch (error) {
      console.error('Error getting popular templates:', error);
      throw error;
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(
    templateId: string, 
    rating: number, 
    userId: string,
    comment?: string
  ): Promise<void> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      await runTransaction(db, async (transaction) => {
        const templateRef = doc(db, 'scheduleTemplates', templateId);
        const templateDoc = await transaction.get(templateRef);

        if (!templateDoc.exists()) {
          throw new Error('Template not found');
        }

        const currentData = templateDoc.data();
        const currentTotal = currentData.total_ratings || 0;
        const currentSum = (currentData.average_rating || 0) * currentTotal;
        
        const newTotal = currentTotal + 1;
        const newAverage = (currentSum + rating) / newTotal;

        transaction.update(templateRef, {
          total_ratings: newTotal,
          average_rating: newAverage,
          updatedAt: serverTimestamp(),
        });

        // Record individual rating
        if (comment) {
          const ratingRef = doc(collection(db, 'templateRatings'));
          transaction.set(ratingRef, {
            templateId,
            userId,
            rating,
            comment,
            createdAt: serverTimestamp(),
          });
        }
      });

    } catch (error) {
      console.error('Error rating template:', error);
      throw new Error(`Failed to rate template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to template changes
   */
  subscribeToTemplates(
    companyId: string,
    callback: (templates: ScheduleTemplate[]) => void,
    filters: TemplateFilters = {}
  ): () => void {
    try {
      let q = query(
        collection(db, 'scheduleTemplates'),
        where('companyId', '==', companyId),
        orderBy('updatedAt', 'desc')
      );

      if (filters.isActive !== undefined) {
        q = query(q, where('isActive', '==', filters.isActive));
      }

      const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot) => {
        const templates: ScheduleTemplate[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const template: ScheduleTemplate = {
            templateId: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as ScheduleTemplate;

          if (this.matchesFilters(template, filters)) {
            templates.push(template);
          }
        });

        callback(templates);
      });

      return unsubscribe;

    } catch (error) {
      console.error('Error subscribing to templates:', error);
      return () => {};
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private matchesFilters(template: ScheduleTemplate, filters: TemplateFilters): boolean {
    if (filters.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase();
      if (!template.templateName.toLowerCase().includes(searchTerm) &&
          !template.description?.toLowerCase().includes(searchTerm)) {
        return false;
      }
    }

    if (filters.duration) {
      if (template.duration < filters.duration.min || template.duration > filters.duration.max) {
        return false;
      }
    }

    return true;
  }

  private calculateScheduleDates(
    template: ScheduleTemplate,
    startDate: Date,
    endDate?: Date
  ): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date(startDate);
    const finalDate = endDate || addMonths(startDate, 3); // Default 3 months

    const { recurrence } = template;

    while (currentDate <= finalDate) {
      // Add current date if it matches recurrence pattern
      if (this.matchesRecurrencePattern(currentDate, recurrence, startDate)) {
        dates.push(new Date(currentDate));
      }

      // Move to next date based on recurrence type
      switch (recurrence.type) {
        case 'daily':
          currentDate = addDays(currentDate, recurrence.interval);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, recurrence.interval);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, recurrence.interval);
          break;
        default:
          currentDate = addDays(currentDate, 1);
      }
    }

    return dates;
  }

  private matchesRecurrencePattern(
    date: Date,
    recurrence: ScheduleTemplate['recurrence'],
    _startDate: Date
  ): boolean {
    if (recurrence.type === 'weekly' && recurrence.daysOfWeek) {
      const dayOfWeek = date.getDay();
      return recurrence.daysOfWeek.includes(dayOfWeek);
    }

    return true; // For daily and monthly, all dates in the sequence are valid
  }

  private async createScheduleFromTemplate(
    template: ScheduleTemplate,
    date: Date,
    employeeId: string,
    options: TemplateApplicationOptions,
    createdBy: string
  ): Promise<Schedule> {
    // Create start and end date times
    const startTime = options.customizations?.startTime || template.defaultStartTime;
    const endTime = options.customizations?.endTime || template.defaultEndTime;
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startDateTime = new Date(date);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    const endDateTime = new Date(date);
    endDateTime.setHours(endHour, endMinute, 0, 0);
    
    // If end time is before start time, assume it's next day
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    // Fetch employee and job site data to populate names
    const jobSiteId = options.jobSiteId || template.jobSiteId || '';
    let employeeName = 'Unknown Employee';
    let jobSiteName = 'Unknown Job Site';

    try {
      // Fetch employee data
      const employeeDoc = await getDoc(doc(db, 'users', employeeId));
      if (employeeDoc.exists()) {
        const employeeData = employeeDoc.data();
        const firstName = employeeData.profile?.firstName || '';
        const lastName = employeeData.profile?.lastName || '';
        employeeName = `${firstName} ${lastName}`.trim() || employeeData.email || 'Unknown Employee';
      }

      // Fetch job site data if we have a valid job site ID
      if (jobSiteId) {
        const jobSiteDoc = await getDoc(doc(db, 'jobSites', jobSiteId));
        if (jobSiteDoc.exists()) {
          const jobSiteData = jobSiteDoc.data();
          jobSiteName = jobSiteData.siteName || 'Unknown Job Site';
        }
      }
    } catch (error) {
      console.error('Error fetching employee/job site data:', error);
      // Continue with default names if fetch fails
    }

    // Create schedule document with correct field names matching Schedule type
    const scheduleData = {
      companyId: template.companyId,
      employeeId,
      employeeName,
      jobSiteId,
      jobSiteName,
      startTime: Timestamp.fromDate(startDateTime), // Fix: Use startTime not startDateTime
      endTime: Timestamp.fromDate(endDateTime),     // Fix: Use endTime not endDateTime
      shiftType: template.shiftType,
      status: 'scheduled' as const,
      notes: options.customizations?.specialInstructions || template.specialInstructions,
      createdBy,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isRecurring: false,
      breakDuration: options.customizations?.breakDuration || template.breakDuration,
      expectedHours: template.duration,
      skillsRequired: template.skillsRequired || [],
      equipmentNeeded: template.equipmentNeeded || [],
      specialInstructions: options.customizations?.specialInstructions || template.specialInstructions || '',
      requiresApproval: false,
      metadata: {
        createdFromTemplate: template.templateId,
        templateName: template.templateName,
        priority: 'medium',
        color: '#1976d2',
      },
    };

    // Add to Firestore with correct field names matching deployed indexes
    const docRef = await addDoc(collection(db, 'schedules'), scheduleData);

    return {
      id: docRef.id,
      scheduleId: docRef.id,
      ...scheduleData,
      startTime: scheduleData.startTime.toDate(),  // Convert Timestamp to Date
      endTime: scheduleData.endTime.toDate(),      // Convert Timestamp to Date
      startDateTime,    // Include Date objects for compatibility
      endDateTime,      // Include Date objects for compatibility
      createdAt: scheduleData.createdAt.toDate(),  // Convert Timestamp to Date
      updatedAt: scheduleData.updatedAt.toDate(),  // Convert Timestamp to Date
    } as Schedule;
  }

  private async initializeTemplateAnalytics(templateId: string): Promise<void> {
    try {
      // Use setDoc with templateId as document ID, not addDoc
      const analyticsRef = doc(db, 'templateAnalytics', templateId);
      await setDoc(analyticsRef, {
        templateId,
        totalUsage: 0,
        lastUsed: null,
        averageRating: 0,
        totalRatings: 0,
        createdSchedulesCount: 0,
        popularTimes: [],
        popularJobSites: [],
        performance: {
          creationSpeed: 0,
          accuracy: 0,
          userSatisfaction: 0,
        },
        trends: {
          weeklyUsage: [],
          monthlyGrowth: 0,
          peakUsageDays: [],
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('Template analytics document created for:', templateId);
    } catch (error) {
      console.error('Error initializing template analytics:', error);
      throw error; // Re-throw to handle in calling function
    }
  }

  private async recordTemplateUsage(templateId: string, schedulesCreated: number): Promise<void> {
    try {
      const templateRef = doc(db, 'scheduleTemplates', templateId);
      
      await updateDoc(templateRef, {
        usage_count: increment(1),
        last_used: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update analytics - create if doesn't exist
      const analyticsRef = doc(db, 'templateAnalytics', templateId);
      
      try {
        await updateDoc(analyticsRef, {
          totalUsage: increment(1),
          createdSchedulesCount: increment(schedulesCreated),
          lastUsed: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('Template usage recorded successfully for:', templateId);
      } catch (analyticsError: any) {
        // If document doesn't exist, create it and retry
        if (analyticsError?.code === 'not-found') {
          console.log('Analytics document not found, creating it...');
          try {
            await this.initializeTemplateAnalytics(templateId);
            // Try the update again after creation
            await updateDoc(analyticsRef, {
              totalUsage: increment(1),
              createdSchedulesCount: increment(schedulesCreated),
              lastUsed: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            console.log('Template usage recorded after creating analytics document');
          } catch (createError) {
            console.error('Failed to create analytics document:', createError);
            // Don't throw - analytics failures shouldn't break template application
          }
        } else {
          console.error('Analytics update error:', analyticsError);
          // Don't throw - analytics failures shouldn't break template application
        }
      }

    } catch (error) {
      console.error('Error recording template usage:', error);
    }
  }

  async generateReportData(
    _companyId: string
  ): Promise<any> {
    // Placeholder for report generation
    // This would analyze template usage, efficiency metrics, etc.
    return {
      totalTemplates: 0,
      activeTemplates: 0,
      mostUsedTemplate: null,
      usageTrends: []
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const templateService = TemplateService.getInstance();
export default templateService; 