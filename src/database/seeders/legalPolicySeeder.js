exports.seedLegalPolicies = async (db) => {
  await db.legalPolicyDocument.upsert({
    where: {
      type_version: {
        type: 'TERMS',
        version: '1.0.0',
      },
    },
    update: {
      title: 'Terms and Conditions',
      isActive: true,
    },
    create: {
      type: 'TERMS',
      version: '1.0.0',
      title: 'Terms and Conditions',
      content: 'Default DijitoPay terms and conditions.',
      isActive: true,
    },
  });

  await db.legalPolicyDocument.upsert({
    where: {
      type_version: {
        type: 'PRIVACY',
        version: '1.0.0',
      },
    },
    update: {
      title: 'Privacy Policy',
      isActive: true,
    },
    create: {
      type: 'PRIVACY',
      version: '1.0.0',
      title: 'Privacy Policy',
      content: 'Default DijitoPay privacy policy.',
      isActive: true,
    },
  });

  console.log('✅ Legal policies seeded');
};
