// scripts/migrateToVariants.js - Script để migrate dữ liệu Pet hiện có thành variants
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Pet = require('../src/models/Pet');
const PetVariant = require('../src/models/PetVariant');

async function migrateExistingPetsToVariants() {
  try {
    console.log('🚀 Starting migration from Pets to PetVariants...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/petshop');
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả pets hiện có
    const pets = await Pet.find({}).lean();
    console.log(`📦 Found ${pets.length} pets to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const pet of pets) {
      try {
        console.log(`🔄 Processing pet: ${pet.name} (${pet._id})`);

        // Kiểm tra xem pet đã có variant chưa
        const existingVariant = await PetVariant.findOne({ pet_id: pet._id });
        
        if (existingVariant) {
          console.log(`   ⏭️  Pet already has variants, skipping...`);
          skippedCount++;
          continue;
        }

        // Tạo variant mặc định từ thông tin pet
        const variantData = {
          pet_id: pet._id,
          color: pet.color || getDefaultColor(pet.type),
          weight: pet.weight || getDefaultWeight(pet.type),
          gender: pet.gender || 'Male',
          age: pet.age || 1,
          price_adjustment: 0,
          stock_quantity: 1,
          is_available: pet.status === 'available'
        };

        const newVariant = new PetVariant(variantData);
        await newVariant.save();

        console.log(`   ✅ Created variant: ${newVariant.display_name || newVariant.getDisplayName()}`);
        migratedCount++;

      } catch (error) {
        console.log(`   ❌ Error processing pet ${pet.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount} pets`);
    console.log(`   ⏭️  Skipped (already has variants): ${skippedCount} pets`);
    console.log(`   ❌ Errors: ${errorCount} pets`);
    console.log(`   📋 Total processed: ${pets.length} pets\n`);

    // Tạo thêm một số variants mẫu cho demo
    if (migratedCount > 0) {
      console.log('🎨 Creating additional sample variants for demonstration...\n');
      await createSampleVariants();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Helper function để tạo màu mặc định theo loại pet
function getDefaultColor(petType) {
  const colorsByType = {
    'Dog': 'Brown',
    'Cat': 'Gray',
    'Rabbit': 'White',
    'Bird': 'Yellow',
    'Fish': 'Gold',
    'Hamster': 'Brown'
  };
  
  return colorsByType[petType] || 'Mixed';
}

// Helper function để tạo cân nặng mặc định theo loại pet
function getDefaultWeight(petType) {
  const weightsByType = {
    'Dog': 15,
    'Cat': 4,
    'Rabbit': 2,
    'Bird': 0.5,
    'Fish': 0.2,
    'Hamster': 0.3
  };
  
  return weightsByType[petType] || 5;
}

// Tạo thêm variants mẫu cho một số pets
async function createSampleVariants() {
  try {
    // Lấy 5 pets đầu tiên để tạo variants mẫu
    const samplePets = await Pet.find({}).limit(5).lean();
    
    for (const pet of samplePets) {
      const baseVariant = await PetVariant.findOne({ pet_id: pet._id });
      if (!baseVariant) continue;

      console.log(`🎨 Creating sample variants for ${pet.name}...`);

      // Tạo variants với màu khác nhau
      const colors = ['Black', 'White', 'Brown', 'Gray', 'Golden'];
      const ages = [1, 2, 3];
      const weights = pet.type === 'Dog' ? [10, 15, 20] : [3, 4, 5];

      let variantCount = 0;
      
      for (let i = 0; i < 3 && variantCount < 5; i++) {
        try {
          const variantData = {
            pet_id: pet._id,
            color: colors[i % colors.length],
            weight: weights[i % weights.length],
            gender: i % 2 === 0 ? 'Male' : 'Female',
            age: ages[i % ages.length],
            price_adjustment: (i - 1) * 100000, // -100k, 0, +100k
            stock_quantity: Math.floor(Math.random() * 5) + 1,
            is_available: true
          };

          // Kiểm tra variant đã tồn tại chưa
          const exists = await PetVariant.findOne({
            pet_id: pet._id,
            color: variantData.color,
            weight: variantData.weight,
            gender: variantData.gender,
            age: variantData.age
          });

          if (!exists) {
            const newVariant = new PetVariant(variantData);
            await newVariant.save();
            console.log(`   ✅ Created sample variant: ${newVariant.getDisplayName()}`);
            variantCount++;
          }
        } catch (error) {
          if (error.code !== 11000) { // Ignore duplicate errors
            console.log(`   ⚠️  Error creating sample variant:`, error.message);
          }
        }
      }
    }
    
    console.log('✅ Sample variants creation completed\n');
  } catch (error) {
    console.error('❌ Error creating sample variants:', error);
  }
}

// Chạy migration
if (require.main === module) {
  migrateExistingPetsToVariants()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateExistingPetsToVariants };