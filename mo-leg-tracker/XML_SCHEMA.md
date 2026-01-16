# XML Schema Reference

## BillList.XML

```xml
<ROOT>
  <BillXML>
    <BillType>HB</BillType>
    <BillNumber>1607</BillNumber>
    <SessionYear>2026</SessionYear>
    <SessionCode>R</SessionCode>
    <BillXMLLink>https://documents.house.mo.gov/xml/261-HB1607.xml</BillXMLLink>
    <LastTimeRun>01-15-2026 17:30:10.267</LastTimeRun>
  </BillXML>
  <!-- ... more bills -->
</ROOT>
```

## Individual Bill XML (e.g., 261-HB1607.xml)

```xml
<ROOT>
  <BillInformation>
    <BillNumber>HB1607</BillNumber>
    <CurrentBillString>HB 1607</CurrentBillString>
    <SubstitutedBy/>
    <Title>
      <ShortTitle>PROPERTY TAX</ShortTitle>
      <LongTitle>Changes provisions relating to property tax...</LongTitle>
    </Title>
    <ProposedEffectiveDate>2026-08-28</ProposedEffectiveDate>
    <CurrentLRNumber>5106H.01I</CurrentLRNumber>
    <GovernorLastAction/>
    <LastAction>01-10-2026 - Read Second Time (H)</LastAction>
    <NextHouseHearing>Hearing not scheduled</NextHouseHearing>
    <Calendar/>

    <!-- Actions -->
    <Action>
      <Link>https://house.mo.gov/bill.aspx?bill=HB1607...</Link>
      <Description>Introduced and Read First Time (H)</Description>
      <Guid>580123</Guid>
      <ActivitySequence>100</ActivitySequence>
      <PubDate>2026-01-08</PubDate>
      <HouseJournalStartPage>45</HouseJournalStartPage>
      <HouseJournalEndPage>45</HouseJournalEndPage>
      <JournalLink>https://documents.house.mo.gov/...</JournalLink>
      <RollCall>
        <TotalYes>138</TotalYes>
        <TotalNo>15</TotalNo>
        <TotalPresent>1</TotalPresent>
      </RollCall>
    </Action>

    <!-- Amendments -->
    <Amendment>
      <AmendmentText>https://documents.house.mo.gov/.../5106H.01H.pdf</AmendmentText>
      <LRNumber>5106H.01H</LRNumber>
      <Status>A</Status>
      <StatusDescription>Adopted</StatusDescription>
      <AmendmentDescription>HA 1</AmendmentDescription>
      <Sponsor>Smith</Sponsor>
      <AmendmentSortValue>0101HH</AmendmentSortValue>
    </Amendment>

    <!-- Sponsors -->
    <Sponsor>
      <FirstName>John</FirstName>
      <LastName>Smith</LastName>
      <District>042</District>
      <Chamber>H</Chamber>
    </Sponsor>

    <!-- Co-Sponsors -->
    <CoSponsor>
      <FirstName>Jane</FirstName>
      <LastName>Doe</LastName>
      <District>065</District>
      <Chamber>H</Chamber>
    </CoSponsor>

    <!-- Bill Documents -->
    <BillDocument>
      <DocumentName>Introduced</DocumentName>
      <DocumentURL>https://documents.house.mo.gov/.../5106H.01I.pdf</DocumentURL>
    </BillDocument>
    <BillDocument>
      <DocumentName>Bill Summary</DocumentName>
      <DocumentURL>https://documents.house.mo.gov/.../HB1607I.pdf</DocumentURL>
    </BillDocument>
    <BillDocument>
      <DocumentName>Fiscal Note</DocumentName>
      <DocumentURL>https://documents.house.mo.gov/.../5106H.01I.ORG.pdf</DocumentURL>
    </BillDocument>
  </BillInformation>
</ROOT>
```

## MemberList.XML

```xml
<ROOT>
  <RepresentativeXML>
    <RepresentativeDistrict>001</RepresentativeDistrict>
    <RepresentativeXMLLink>https://documents.house.mo.gov/xml/261-001.xml</RepresentativeXMLLink>
    <LastTimeRun>01-15-2026 17:30:09.570</LastTimeRun>
  </RepresentativeXML>
  <!-- ... more members -->
</ROOT>
```

## Individual Member XML (e.g., 261-001.xml)

```xml
<ROOT>
  <RepresentativeInformation>
    <FirstName>Jeff</FirstName>
    <LastName>Farnan</LastName>
    <DistrictNumber>001</DistrictNumber>
    <Party>Republican</Party>
    <YearElected>2022</YearElected>
    <YearsServed>4</YearsServed>
    <Hometown>Stanberry</Hometown>
    <CapitolAddress>MO House of Representatives, 201 West Capitol Avenue, Room 410-A, Jefferson City MO 65101</CapitolAddress>
    <PhoneNumber>573-751-9465</PhoneNumber>
    <EmailAddress>Jeff.Farnan@house.mo.gov</EmailAddress>
    <LegislativeAssistant>Lisa Porter</LegislativeAssistant>
    <Biography>...</Biography>
    <PhotoLink>https://images.house.mo.gov/MemberPhoto.aspx?id=2354</PhotoLink>

    <!-- Counties -->
    <County>Atchison</County>
    <County>Gentry</County>
    <County>Holt</County>
    <County>Nodaway</County>

    <!-- Committee Assignments -->
    <CommitteeAssignment>
      <Name>Conservation and Natural Resources</Name>
      <Position>Chair</Position>
    </CommitteeAssignment>
    <CommitteeAssignment>
      <Name>Agriculture</Name>
      <Position>Member</Position>
    </CommitteeAssignment>

    <!-- Legislation Sponsored -->
    <Legislation>
      <Bill>HB 2035</Bill>
      <Description>Artificially generated material provisions</Description>
    </Legislation>
    <Legislation>
      <Bill>HB 2036</Bill>
      <Description>Motor vehicle inspection requirements</Description>
    </Legislation>
  </RepresentativeInformation>
</ROOT>
```

## CommitteeList.XML

```xml
<ROOT>
  <CommitteeXML>
    <ID>4286</ID>
    <Type>Admin and Review</Type>
    <Name>Administration and Accounts</Name>
    <CommitteeMembers>
      <CommitteeMember>
        <MemberName>Peggy McGaugh</MemberName>
        <MemberDistrict>007</MemberDistrict>
        <PositionName>Chair</PositionName>
        <Chamber>H</Chamber>
      </CommitteeMember>
      <CommitteeMember>
        <MemberName>Richard West</MemberName>
        <MemberDistrict>102</MemberDistrict>
        <PositionName>Vice-Chair</PositionName>
        <Chamber>H</Chamber>
      </CommitteeMember>
      <!-- ... more members -->
    </CommitteeMembers>
  </CommitteeXML>
  <!-- ... more committees -->
</ROOT>
```

## UpcomingHearingList.XML

```xml
<ROOT>
  <HearingXML>
    <HearingID>10976</HearingID>
    <CommitteeID>4308</CommitteeID>
    <CommitteeName>Government Efficiency</CommitteeName>
    <CommitteeChairFirstName>Wendy L.</CommitteeChairFirstName>
    <CommitteeChairLastName>Hausman</CommitteeChairLastName>
    <CommitteeChairDistrict>65</CommitteeChairDistrict>
    <CommitteeChairChamber>H</CommitteeChairChamber>
    <HearingLocation>House Hearing Room 7</HearingLocation>
    <HearingDate>01/15/2026</HearingDate>
    <HearingTime>8:00 AM</HearingTime>
    <HearingStatus>Amended</HearingStatus>
    <HearingProgress>Adjourned</HearingProgress>
    <AdjournedTime>09:31:35 AM</AdjournedTime>
    <Comments>Removed HB 2743</Comments>

    <HearingBills>
      <HearingBill>
        <CurrentBillString>HB 1790</CurrentBillString>
        <ShortTitle>TAX LEVIES BY POLITICAL SUBDIVISIONS</ShortTitle>
        <SponsorFirstName>Jim</SponsorFirstName>
        <SponsorLastName>Murphy</SponsorLastName>
        <SponsorDistrict>94</SponsorDistrict>
        <SponsorChamber>H</SponsorChamber>
      </HearingBill>
      <!-- ... more bills -->
    </HearingBills>
  </HearingXML>
  <!-- ... more hearings -->
</ROOT>
```

## CalendarList.XML

```xml
<ROOT>
  <CalendarXML>
    <SessionDay>Seventh Day, Tuesday, January 20, 2026</SessionDay>
    <CalendarName>House Bills for Second Reading</CalendarName>
    <BillType>HB</BillType>
    <BillNumber>2992</BillNumber>
    <CurrentBillString>HB 2992</CurrentBillString>
    <SponsorFirstName>Ed</SponsorFirstName>
    <SponsorLastName>Lewis</SponsorLastName>
    <SponsorDistrict>6</SponsorDistrict>
    <SponsorChamber>H</SponsorChamber>
    <ShortTitle>GRANTS FOR POSTSECONDARY EDUCATION</ShortTitle>
  </CalendarXML>
  <!-- ... more calendar items -->
</ROOT>
```

## SessionList.XML

```xml
<ROOT>
  <SessionXML>
    <ID>261</ID>
    <Name>2026 Regular Session</Name>
    <SessionYear>2026</SessionYear>
    <SessionCode>R</SessionCode>
    <GeneralAssembly>103rd General Assembly</GeneralAssembly>
    <SessionOfGeneralAssembly>2nd Regular Session</SessionOfGeneralAssembly>
  </SessionXML>
  <!-- ... more sessions back to 2000 -->
</ROOT>
```

## Action Status Codes (Common)

| Description | Stage |
|-------------|-------|
| Introduced and Read First Time (H) | Introduction |
| Read Second Time (H) | First Reading |
| Referred: {Committee}(H) | Committee Assignment |
| Public Hearing Scheduled (H) | Hearing |
| Public Hearing Completed (H) | Hearing |
| Executive Session Completed (H) | Committee Work |
| HCS Voted Do Pass (H) | Committee Vote |
| HCS Reported Do Pass (H) | Reported Out |
| Taken Up for Perfection (H) | Floor Debate |
| Perfected with Amendments (H) | Perfection |
| Taken Up for Third Reading (H) | Final Passage |
| Third Read and Passed (H) | Passed Chamber |
| Delivered to the Senate | Cross-Chamber |
| Truly Agreed To and Finally Passed | Final Passage |
| Signed by House Speaker (H) | Enrollment |
| Signed by President Pro Tem (S) | Enrollment |
| Delivered to Governor | Executive |
| Signed by Governor (G) | Enacted |
| Vetoed by Governor (G) | Vetoed |
| Vetoed in Part by Governor (G) | Partial Veto |

## Amendment Status Codes

| Code | Description |
|------|-------------|
| A | Adopted |
| G | Distributed (pending) |
| W | Withdrawn |
| D | Defeated |
