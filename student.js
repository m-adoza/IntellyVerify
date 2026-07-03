/**
 * ============================================================
 * FILE: js/student.js
 * PURPOSE: Student Dashboard Logic
 * MODULE: Student
 * DEPENDENCIES: js/config.js, js/auth.js
 * DESCRIPTION: Fetches student data, statistics, notifications, and messages
 * ============================================================
 */

if (typeof window.supabaseClient === 'undefined') {
    console.error('❌ Supabase client not found. Ensure js/config.js is loaded first.');
}

const supabase = window.supabaseClient;

/**
 * Fetch student profile data
 * @param {string} userId - The user's UUID
 * @returns {Promise<{profile: object, error: object}>}
 */
async function getStudentProfile(userId) {
    try {
        // Get student data
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        // Get user data
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('first_name, middle_name, last_name, email, phone_number')
            .eq('user_id', userId)
            .maybeSingle();

        if (userError) throw userError;

        return {
            profile: {
                ...data,
                ...userData,
                full_name: `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim()
            },
            error: null
        };
    } catch (error) {
        console.error('Error fetching student profile:', error.message);
        return { profile: null, error: error };
    }
}

/**
 * Fetch dashboard statistics
 * @param {string} studentId - The student's UUID
 * @returns {Promise<{stats: object, error: object}>}
 */
async function getStudentStats(studentId) {
    try {
        // Get topic counts
        const { data: topics, error: topicError } = await supabase
            .from('topics')
            .select('status')
            .eq('student_id', studentId);

        if (topicError) throw topicError;

        const stats = {
            total: topics?.length || 0,
            pending: topics?.filter(t => t.status === 'pending' || t.status === 'submitted' || t.status === 'under_review').length || 0,
            approved: topics?.filter(t => t.status === 'approved').length || 0,
            rejected: topics?.filter(t => t.status === 'rejected').length || 0,
            draft: topics?.filter(t => t.status === 'draft').length || 0,
            avgSimilarity: 0
        };

        return { stats, error: null };
    } catch (error) {
        console.error('Error fetching student stats:', error.message);
        return { stats: null, error: error };
    }
}

/**
 * Fetch recent notifications
 * @param {string} userId - The user's UUID
 * @param {number} limit - Number of notifications to fetch
 * @returns {Promise<{notifications: array, unreadCount: number, error: object}>}
 */
async function getStudentNotifications(userId, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const { count, error: countError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (countError) throw countError;

        return {
            notifications: data || [],
            unreadCount: count || 0,
            error: null
        };
    } catch (error) {
        console.error('Error fetching notifications:', error.message);
        return { notifications: [], unreadCount: 0, error: error };
    }
}

/**
 * Fetch recent messages
 * @param {string} userId - The user's UUID
 * @param {number} limit - Number of messages to fetch
 * @returns {Promise<{messages: array, unreadCount: number, error: object}>}
 */
async function getStudentMessages(userId, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const { count, error: countError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);

        if (countError) throw countError;

        return {
            messages: data || [],
            unreadCount: count || 0,
            error: null
        };
    } catch (error) {
        console.error('Error fetching messages:', error.message);
        return { messages: [], unreadCount: 0, error: error };
    }
}

/**
 * Get current project status (most recent topic)
 * @param {string} studentId - The student's UUID
 * @returns {Promise<{topic: object, error: object}>}
 */
async function getCurrentProjectStatus(studentId) {
    try {
        const { data, error } = await supabase
            .from('topics')
            .select('*')
            .eq('student_id', studentId)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return { topic: data, error: null };
    } catch (error) {
        console.error('Error fetching project status:', error.message);
        return { topic: null, error: error };
    }
}

/**
 * Get student activity history
 * @param {string} userId - The user's UUID
 * @param {number} limit - Number of activities to fetch
 * @returns {Promise<{activities: array, error: object}>}
 */
async function getStudentActivity(userId, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return { activities: data || [], error: null };
    } catch (error) {
        console.error('Error fetching activities:', error.message);
        return { activities: [], error: error };
    }
}

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @returns {Promise<{error: object}>}
 */
async function markNotificationRead(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('notification_id', notificationId);

        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Error marking notification read:', error.message);
        return { error: error };
    }
}

/**
 * Mark a message as read
 * @param {string} messageId - The message ID
 * @returns {Promise<{error: object}>}
 */
async function markMessageRead(messageId) {
    try {
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('message_id', messageId);

        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Error marking message read:', error.message);
        return { error: error };
    }
}

// Export globally
window.getStudentProfile = getStudentProfile;
window.getStudentStats = getStudentStats;
window.getStudentNotifications = getStudentNotifications;
window.getStudentMessages = getStudentMessages;
window.getCurrentProjectStatus = getCurrentProjectStatus;
window.getStudentActivity = getStudentActivity;
window.markNotificationRead = markNotificationRead;
window.markMessageRead = markMessageRead;

console.log('✅ Student module loaded.');