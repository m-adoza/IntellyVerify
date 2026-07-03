/**
 * ============================================================
 * FILE: js/auth.js
 * PURPOSE: Authentication & Session Management
 * MODULE: Authentication
 * DEPENDENCIES: js/config.js (supabaseClient)
 * DESCRIPTION: Handles login, registration, logout, password reset, and session management
 * ============================================================
 */

// Ensure the Supabase client is available
if (typeof window.supabaseClient === 'undefined') {
    console.error('❌ Supabase client not found. Ensure js/config.js is loaded first.');
}

const supabase = window.supabaseClient;

/**
 * Register a new student account
 * @param {object} userData - Registration form data
 * @returns {Promise<{user: object, error: object}>}
 */
async function registerUser(userData) {
    try {
        // Step 1: Create auth account
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    first_name: userData.firstName,
                    middle_name: userData.middleName || '',
                    last_name: userData.lastName,
                    phone: userData.phone || '',
                    role: 'student'
                }
            }
        });

        if (error) throw error;

        const user = data.user;

        // Step 2: Insert student profile (trigger will handle users table)
        const { error: profileError } = await supabase
            .from('students')
            .insert([{
                user_id: user.id,
                matric_number: userData.matricNumber,
                faculty_id: userData.facultyId || null,
                department_id: userData.departmentId || null,
                level: userData.level || null,
                registration_date: new Date().toISOString()
            }]);

        if (profileError) {
            console.error('Profile creation failed:', profileError);
            throw profileError;
        }

        return { user, error: null };
    } catch (error) {
        console.error('Registration error:', error.message);
        return { user: null, error: error };
    }
}

/**
 * Login a user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @param {boolean} rememberMe - Whether to persist session
 * @returns {Promise<{user: object, role: string, error: object}>}
 */
async function loginUser(email, password, rememberMe = false) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        const user = data.user;

        // Get user role from the users table
        const role = await getUserRole(user.id);

        // Store session data
        const sessionData = {
            user: user,
            role: role,
            loggedInAt: new Date().toISOString()
        };

        if (rememberMe) {
            localStorage.setItem('intelliverify_session', JSON.stringify(sessionData));
        } else {
            sessionStorage.setItem('intelliverify_session', JSON.stringify(sessionData));
        }

        return { user, role, error: null };
    } catch (error) {
        console.error('Login error:', error.message);
        return { user: null, role: null, error: error };
    }
}

/**
 * Logout the current user
 * @returns {Promise<{error: object}>}
 */
async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Clear local session
        localStorage.removeItem('intelliverify_session');
        sessionStorage.removeItem('intelliverify_session');

        // Redirect to login page
        window.location.href = '../login.html';
        return { error: null };
    } catch (error) {
        console.error('Logout error:', error.message);
        return { error: error };
    }
}

/**
 * Send password reset email
 * @param {string} email - User's email address
 * @returns {Promise<{error: object}>}
 */
async function resetPassword(email) {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Password reset error:', error.message);
        return { error: error };
    }
}

/**
 * Update user's password (for reset flow)
 * @param {string} newPassword - New password
 * @returns {Promise<{error: object}>}
 */
async function updatePassword(newPassword) {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Update password error:', error.message);
        return { error: error };
    }
}

/**
 * Get the current user's role from the database
 * @param {string} userId - The user's UUID
 * @returns {Promise<string>} - 'student', 'supervisor', 'admin', or 'super_admin'
 */
async function getUserRole(userId) {
    try {
        // Query the users table
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data?.role || 'student';
    } catch (error) {
        console.error('Error fetching role:', error.message);
        return 'student';
    }
}

/**
 * Get the current authenticated user
 * @returns {Promise<{user: object, role: string, error: object}>}
 */
async function getCurrentUser() {
    try {
        // Check session storage first
        let sessionData = sessionStorage.getItem('intelliverify_session');
        if (!sessionData) {
            sessionData = localStorage.getItem('intelliverify_session');
        }

        if (sessionData) {
            const parsed = JSON.parse(sessionData);
            return { user: parsed.user, role: parsed.role, error: null };
        }

        // If no session, check with Supabase
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
            return { user: null, role: null, error: null };
        }

        const user = data.session.user;
        const role = await getUserRole(user.id);

        // Store for future
        const storeData = { user, role, loggedInAt: new Date().toISOString() };
        sessionStorage.setItem('intelliverify_session', JSON.stringify(storeData));

        return { user, role, error: null };
    } catch (error) {
        console.error('Get current user error:', error.message);
        return { user: null, role: null, error: error };
    }
}

/**
 * Redirect user based on their role
 * @param {string} role - User's role
 * @param {string} currentPage - Current page path
 */
function redirectToDashboard(role, currentPage = '') {
    const roleMap = {
        student: '../student/dashboard.html',
        supervisor: '../supervisor/dashboard.html',
        admin: '../admin/dashboard.html',
        super_admin: '../superadmin/dashboard.html'
    };

    const target = roleMap[role] || '../login.html';
    if (currentPage && currentPage.includes(target)) return;
    window.location.href = target;
}

/**
 * Protect a page: redirect to login if not authenticated
 * @param {string} requiredRole - Optional: require a specific role
 * @param {string} currentPage - Current page path
 * @returns {Promise<{user: object, role: string}>}
 */
async function protectPage(requiredRole = null, currentPage = '') {
    const { user, role, error } = await getCurrentUser();

    if (error || !user) {
        window.location.href = '../login.html';
        return null;
    }

    if (requiredRole && role !== requiredRole) {
        redirectToDashboard(role, currentPage);
        return null;
    }

    return { user, role };
}

// Export functions globally
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.resetPassword = resetPassword;
window.updatePassword = updatePassword;
window.getCurrentUser = getCurrentUser;
window.redirectToDashboard = redirectToDashboard;
window.protectPage = protectPage;
window.getUserRole = getUserRole;

console.log('✅ Authentication module loaded.');