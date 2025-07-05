const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
const app = initializeApp({
  credential: credential.cert(serviceAccount),
});

const db = getFirestore(app);

async function checkAndCreateAssignments() {
  console.log('🔍 Checking User Assignments...');
  
  try {
    // Step 1: Get the employee user
    const employeeUserId = 'D9uRAKHen6U52etCQeILhBX977g2'; // From the fix script output
    const employeeDoc = await db.collection('users').doc(employeeUserId).get();
    
    if (!employeeDoc.exists) {
      console.log('❌ Employee user document not found');
      return;
    }
    
    const employeeData = employeeDoc.data();
    console.log(`👤 Employee: ${employeeData.email} (Company: ${employeeData.companyId})`);
    
    // Step 2: Check existing assignments
    const assignmentsSnapshot = await db.collection('userAssignments')
      .where('userId', '==', employeeUserId)
      .get();
    
    console.log(`📝 Found ${assignmentsSnapshot.docs.length} existing assignments`);
    
    assignmentsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - Assignment ID: ${doc.id}`);
      console.log(`     Job Site ID: ${data.jobSiteId}`);
      console.log(`     Is Active: ${data.isActive}`);
    });
    
    // Step 3: Get all job sites for the company
    const jobSitesSnapshot = await db.collection('jobSites')
      .where('companyId', '==', employeeData.companyId)
      .get();
    
    console.log(`🏢 Found ${jobSitesSnapshot.docs.length} job sites for company`);
    
    const jobSites = [];
    jobSitesSnapshot.forEach(doc => {
      const data = doc.data();
      jobSites.push({
        id: doc.id,
        name: data.siteName,
        address: data.address,
        isActive: data.isActive
      });
      console.log(`   - ${data.siteName} (${doc.id}) - Active: ${data.isActive}`);
    });
    
    // Step 4: Check if employee has assignments to all active job sites
    const assignedJobSiteIds = assignmentsSnapshot.docs.map(doc => doc.data().jobSiteId);
    const activeJobSites = jobSites.filter(site => site.isActive);
    const missingAssignments = activeJobSites.filter(site => !assignedJobSiteIds.includes(site.id));
    
    console.log(`\n📊 Assignment Analysis:`);
    console.log(`   - Active job sites: ${activeJobSites.length}`);
    console.log(`   - Existing assignments: ${assignedJobSiteIds.length}`);
    console.log(`   - Missing assignments: ${missingAssignments.length}`);
    
    if (missingAssignments.length > 0) {
      console.log('\n🔧 Creating missing assignments...');
      
      const batch = db.batch();
      
      missingAssignments.forEach(jobSite => {
        const assignmentRef = db.collection('userAssignments').doc();
        console.log(`   Creating assignment for job site: ${jobSite.name}`);
        
        batch.set(assignmentRef, {
          userId: employeeUserId,
          companyId: employeeData.companyId,
          jobSiteId: jobSite.id,
          isActive: true,
          permissions: {
            canEditTimeEntries: true,
            canViewReports: false,
            canManageOtherUsers: false
          },
          startDate: new Date(),
          createdBy: 'system', // Since this is a fix
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      console.log(`✅ Created ${missingAssignments.length} new assignments`);
    } else {
      console.log('✅ All assignments are already in place');
    }
    
    // Step 5: Final verification
    const finalAssignmentsSnapshot = await db.collection('userAssignments')
      .where('userId', '==', employeeUserId)
      .get();
    
    console.log(`\n🎉 Final status: Employee has ${finalAssignmentsSnapshot.docs.length} job site assignments`);
    
  } catch (error) {
    console.error('❌ Error checking assignments:', error);
    throw error;
  }
}

// Run the check
checkAndCreateAssignments()
  .then(() => {
    console.log('✅ Assignment check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Assignment check failed:', error);
    process.exit(1);
  }); 