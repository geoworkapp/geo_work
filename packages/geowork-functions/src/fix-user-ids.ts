import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { credential } from 'firebase-admin';
import * as serviceAccount from './service-account.json';

// Initialize Firebase Admin
const app = initializeApp({
  credential: credential.cert(serviceAccount as any),
});

const db = getFirestore(app);
const auth = getAuth(app);

interface UserDoc {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  isActive: boolean;
}

async function fixUserIdMismatch() {
  console.log('🔧 Starting User ID Mismatch Fix...');
  
  try {
    // Step 1: Get all user documents from Firestore
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.docs.length} user documents in Firestore`);
    
    const userDocs: UserDoc[] = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      userDocs.push({
        id: doc.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        companyId: data.companyId,
        isActive: data.isActive
      });
    });
    
    // Step 2: For each user document, check if there's a matching Firebase Auth user
    const mismatches: Array<{userDoc: UserDoc, authUser?: any}> = [];
    
    for (const userDoc of userDocs) {
      try {
        // Try to find Firebase Auth user by email
        const authUser = await auth.getUserByEmail(userDoc.email);
        
        if (authUser.uid !== userDoc.id) {
          console.log(`❌ MISMATCH FOUND:`);
          console.log(`   Firestore Doc ID: ${userDoc.id}`);
          console.log(`   Firebase Auth UID: ${authUser.uid}`);
          console.log(`   Email: ${userDoc.email}`);
          
          mismatches.push({ userDoc, authUser });
        } else {
          console.log(`✅ MATCH: ${userDoc.email} - IDs align`);
        }
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.log(`⚠️  NO AUTH USER: ${userDoc.email} - Firestore doc exists but no Firebase Auth user`);
          mismatches.push({ userDoc });
        } else {
          console.error(`❌ Error checking user ${userDoc.email}:`, error);
        }
      }
    }
    
    console.log(`\n📊 Summary: Found ${mismatches.length} mismatches out of ${userDocs.length} users`);
    
    if (mismatches.length === 0) {
      console.log('🎉 No mismatches found! All user IDs are correctly aligned.');
      return;
    }
    
    // Step 3: Fix mismatches by recreating user documents with correct IDs
    console.log('\n🔧 Starting fix process...');
    
    for (const mismatch of mismatches) {
      const { userDoc, authUser } = mismatch;
      
      if (!authUser) {
        console.log(`⏭️  Skipping ${userDoc.email} - no Firebase Auth user exists`);
        continue;
      }
      
      console.log(`\n🔧 Fixing ${userDoc.email}...`);
      
      const batch = db.batch();
      
      // Step 3a: Create new user document with correct Firebase Auth UID
      const newUserRef = db.collection('users').doc(authUser.uid);
      batch.set(newUserRef, {
        uid: authUser.uid,
        email: userDoc.email,
        firstName: userDoc.firstName,
        lastName: userDoc.lastName,
        role: userDoc.role,
        companyId: userDoc.companyId,
        isActive: userDoc.isActive,
        profile: {
          firstName: userDoc.firstName,
          lastName: userDoc.lastName,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Step 3b: Update userAssignments to use correct Firebase Auth UID
      const assignmentsSnapshot = await db.collection('userAssignments')
        .where('userId', '==', userDoc.id)
        .get();
      
      console.log(`   📝 Found ${assignmentsSnapshot.docs.length} assignments to update`);
      
      assignmentsSnapshot.forEach(assignmentDoc => {
        const assignmentData = assignmentDoc.data();
        batch.update(assignmentDoc.ref, {
          userId: authUser.uid,
          updatedAt: new Date(),
        });
      });
      
      // Step 3c: Update any timeEntries to use correct Firebase Auth UID
      const timeEntriesSnapshot = await db.collection('timeEntries')
        .where('userId', '==', userDoc.id)
        .get();
      
      console.log(`   ⏰ Found ${timeEntriesSnapshot.docs.length} time entries to update`);
      
      timeEntriesSnapshot.forEach(timeEntryDoc => {
        batch.update(timeEntryDoc.ref, {
          userId: authUser.uid,
          updatedAt: new Date(),
        });
      });
      
      // Step 3d: Delete old user document
      const oldUserRef = db.collection('users').doc(userDoc.id);
      batch.delete(oldUserRef);
      
      // Commit the batch
      await batch.commit();
      
      console.log(`   ✅ Fixed ${userDoc.email} - moved from ${userDoc.id} to ${authUser.uid}`);
    }
    
    console.log('\n🎉 User ID mismatch fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during user ID fix:', error);
    throw error;
  }
}

// Run the fix
fixUserIdMismatch()
  .then(() => {
    console.log('✅ Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }); 